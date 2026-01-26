# server and client.

1. when the sfu server start we create a worker of mediasoup with that worker we create an router.
2. when any client join the room , then server creates rtpCapabilties for that client using that particular room router. and send those rtpCapabilities to client.
3. Then Client create and mediasoup Device on Client side using mediasoup-client library.and load those rtpCapabilities. and send an message like create an webrtcTransport for producer/consumer to sfu via websocket. eg : `socket.send(JSON.stringify({ "action": "createWebRtcTransport", "direction": "send" }`

4. so at sfu server we on getting message to createWebRtcTransport to sender or producer we create an transport on serverside and assign it to producerTransport and send all those related params of that transport back to client. like iceCandidates,iceParameters,dtlsParameters. same message like create an webrtcTransport for producer/consumer to sfu via websocket. eg : `socket.send(JSON.stringify({ "action": "createWebRtcTransport", "direction": "recv" }` it will create transport at backend for consumerTransport and send back those iceParameters,iceCandidates,dtlsparameters back to client.

`e.g message from server to client : `
producerSocket?.send(JSON.stringify({ type : 'producerTransport',producerTransport:  {"id" : producerTransport.id,
    "iceCandidates" : producerTransport.iceCandidates,
    "iceParameters" : producerTransport.iceParameters,
    "dtlsParameters": producerTransport.dtlsParameters,
}}));`


5. on client side when we recevie message type  from socket server above msg like 'producerTransport' we create an sendTransport on client side using client-side mediasoup library. for producer : ` e.g : sendTransport = device.createSendTransport(msg.producerTransport);` , for consumer :  `consumerTransport = device.createRecvTransport(msg.consumerTransport);`

6. after this we listens event on those transport event created on client side like :  

``` 
sendTransport.on("connect", ({ dtlsParameters }, callback) => {
        console.log("hey boy",dtlsParameters);
        console.log("sendtransport",sendTransport.id);
        socket.send(JSON.stringify({ role : "producer","action":"connectTransport","dtlsParameters":dtlsParameters ,"transportId": sendTransport.id})) ;
        // handleConnectTransport
        pendingCallbackConnectTransport = callback; // so here we save that callback globally and call that callback after getting acknowledgment from server
    }); 
```

when that event triggers it sends an action message to sfu server that connectTransport with it's parameteres and client's transportid with dtlsParameters so using these things that sfu server's producer transport will connect to client side producer transport. based on roles if consumer then it will connect the transport with parameters to sfu server's transport to client transport and sends an acknowledgment to respective clients producer/consumer.: producerSocket.send(JSON.stringify({ type: "transportConnected", transportId:msg.transportId })). on that successfull transport connection we call that pendingCallback (checkout 6 point last line) 

# Server code
` 
e.g else if(msg.action === "connectTransport"){
            const d = msg.dtlsParameters;
            const role = msg.role;
            // console.log("dere",d);
            if(role === "producer"){
                console.log("1 fired.")
                await producerTransport.connect({dtlsParameters : msg.dtlsParameters});
                producerSocket.send(JSON.stringify({ type: "transportConnected", transportId:msg.transportId }))
                return;
            }else if(role === "consumer"){
                await consumerTransport.connect({ dtlsParameters : msg.dtlsParameters});
                consumerSocket.send(JSON.stringify({ type : "transportConnected", transportId : msg.transportId}));
                return;            }
`

# CLient code after getting acknowledgement : 

```
else if(msg.type === "transportConnected"){
        console.log('acknowledgement done.!!');
        pendingCallbackConnectTransport();
        
    }
```

7. So on client side there is another transport event 'produce' is there so when this event trigger it sends message to sfu server to produce on server side:    

// code 
```
sendTransport.on("produce",({kind,rtpParameters},callback)=>{
            socket.send(JSON.stringify({action : "produce",transportId : sendTransport.id,kind,rtpParameters}));
            pendingProduceCallback = callback;
        }) ```

then the sfu server creates an producer at backend

// code 

```
onsole.log("2 fired.")
            const producer = await producerTransport.produce({
                kind : msg.kind,
                rtpParameters : msg.rtpParameters
            });
            producerSocket.send(JSON.stringify({
    type: "produced",
    producerId: producer.id
  }));
```


# Consumer side... 







# Doubts

, when producerTransport will get msg from socket server that video will be going to produce without listening any events stuff.

Good question. The key thing to understand is:

✅ **`sendTransport.produce({ track })` is the thing that triggers the events.**
You are *not* producing “without listening to events” — you *already registered* the listeners before calling `produce()`.

Let’s break it down clearly.

---

## What happens in your code order

You do this in sequence:

### 1) Create sendTransport

```js
sendTransport = device.createSendTransport(...)
```

### 2) Register event handlers

```js
sendTransport.on("connect", ...)
sendTransport.on("produce", ...)
```

### 3) Get screen track

```js
const stream = await getDisplayMedia(...)
const track = stream.getVideoTracks()[0]
```

### 4) Call produce

```js
await sendTransport.produce({ track })
```

---

## Now what does `produce()` actually do internally?

When you call:

```js
sendTransport.produce({ track })
```

mediasoup-client internally says:

### A) “Is my transport connected (DTLS done)?”

* If not connected yet → it triggers:

✅ `sendTransport.on("connect")`

So your `connect` handler runs and you send DTLS to server.

---

### B) “Now I need server to create Producer”

So it triggers:

✅ `sendTransport.on("produce")`

So your `produce` handler runs and you send `{ kind, rtpParameters }` to server.

---

### C) Server creates Producer and returns `producerId`

Then your client calls:

```js
pendingProduceCallback({ id: producerId })
```

So mediasoup-client now finalizes the producer creation.

---

### D) After this, media starts flowing

Now the browser starts sending RTP packets over WebRTC to the SFU.

---

## So why it looks like “it produces without listening”?

Because **you are calling produce() only after setting listeners**.

If you did this wrong order:

❌ wrong order:

```js
await sendTransport.produce({ track }) // called first
sendTransport.on("connect", ...)
sendTransport.on("produce", ...)
```

Then you would get errors like:

* `no "connect" listener set`
* `no "produce" listener set`

---

## Mental model (simple)

Think of `produce()` like a function that says:

> “I want to start sending media.
> If connection not ready, I will ask you for DTLS using `connect` event.
> If server producer not created, I will ask you using `produce` event.”

So `produce()` is the **trigger**, events are the **negotiation hooks**.

---

## Final answer

### When you receive `"producerTransport"` message:

No video is produced yet.

Video starts producing only when you call:

```js
await sendTransport.produce({ track })
```

And that call **automatically triggers**:

* `"connect"` event (DTLS handshake)
* `"produce"` event (server Producer creation)

That’s the correct mediasoup flow. ✅
