import { socket } from "./sockets/sockets"
import {Device} from "mediasoup-client"
let device , sendTransport,pendingCallbackConnectTransport,pendingProduceCallback;

export default function App(){
  

  socket.onmessage = async (event) =>{
    const msg = JSON.parse(event.data);
    if(msg.type === "RTPCAPABILITIES"){
      console.log(' i am here');
      console.log(msg.rtp)
      if(!device) device = new Device();
      await device.load({routerRtpCapabilities : msg.rtp});
      // device = await new Device();
      // await device.load(msg.rtp);
      console.log(' i am here2');
      socket.send(JSON.stringify({ "action": "createWebRtcTransport", "direction": "send" }
))
    }else if(msg.type === "producerTransport"){
      console.log("Producer Transport : ",msg.producerTransport);
      if(device){
    sendTransport = device.createSendTransport(msg.producerTransport);
      
        const stream = await navigator.mediaDevices.getDisplayMedia({video : true,audio : true});
        const track = stream.getVideoTracks()[0];
          // debug event for sendTransport ...
  sendTransport.on("connectionstatechange", (state) => {
  console.log("sendTransport state:", state);
});
    sendTransport.on("connect", ({ dtlsParameters }, callback) => {
    console.log("hey boy",dtlsParameters);
    console.log("sendtransport",sendTransport.id);
    socket.send(JSON.stringify({ "action":"connectTransport","dtlsParameters":dtlsParameters ,"transportId": sendTransport.id})) ;
    // handleConnectTransport
    pendingCallbackConnectTransport = callback;
  });

  sendTransport.on("produce",({kind,rtpParameters},callback)=>{
    socket.send(JSON.stringify({action : "produce",transportId : sendTransport.id,kind,rtpParameters}));
    pendingProduceCallback = callback;
  })

  

      await sendTransport.produce({track})



      console.log("send transport set",sendTransport);

    
      }
      
    }else if(msg.type === "transportConnected"){
      console.log('acknowledgement done.!!');
      pendingCallbackConnectTransport();
    }else if(msg.type === "produced"){
      console.log("producer created at backned with producer id : ",msg.producerId);
      pendingProduceCallback({id : msg.producerId})
    }
    console.log(msg);
  }

  if(sendTransport){
  //   sendTransport.on("connect", ({ dtlsParameters }, callback) => {
  //   console.log("hey boy",dtlsParameters);
  //   console.log("sendtransport",sendTransport.id);
  //   socket.send(JSON.stringify({ "action":"connectTransport","dtlsParameters":dtlsParameters ,"transportId": sendTransport.id})) ;
  //   // handleConnectTransport
  //   pendingCallbackConnectTransport = callback;
  // })
  }
  
      
  function handleJoinRoom(){
    socket.send(JSON.stringify({ type : 'client-joined'}))
  }

  async function handleConnectTransport(){
    // socket.send(JSON.stringify({ }))
    socket.send(JSON.stringify({ "action":"connectTransport","dtlsParameters":{dtlsParameters}})) ;
  }
  
  return <div>
    <button onClick={handleJoinRoom}>Join Room 123</button>
    <br />

  </div>
}