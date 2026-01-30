import { WebSocketServer } from "ws";
import mediasoup from "mediasoup";


let router;

const peers = new Map();
const Room = new Map(router,peers);

const wss = new WebSocketServer({ port : 8080});


(async()=>{
    const worker = await mediasoup.createWorker();
    router = await worker.createRouter({mediaCodecs:[
        {kind : 'video',mimeType:'video/VP8',clockRate:90000}
    ]});

})();

async function createWebRtcTransport(){
    const transport = await router.createWebRtcTransport({
        listenIps:[{ ip : '0.0.0.0',announcedIp : '192.168.31.59'}],
        enableTcp : true,
        enableUdp : true,
        preferUdp : true,
    });
    return transport;
}

wss.on('connection',function connection(ws){
    ws.on('error',console.error);

    ws.on('message',async function message(data){
        const msg = JSON.parse(data);
        if(msg.type === "client-join"){
            console.log("dew",msg);
            if(!router.rtpCapabilities){
                ws.send(JSON.stringify({ msg : "RouterRtpCapabilities Error"}));
                return;
            }
            const wsId = msg.wsId;
            peers.set(wsId,{socket : ws,transports : new Map(),producers : new Map(),consumers : new Map()});
            console.log(' ia m here');
            console.log(peers.get(wsId));
            
            ws.send(JSON.stringify({type : "rtpCapabilities",rtp : router.rtpCapabilities , msg : "success"}));


            // issue : “Meeting already started → new consumer joins → cannot see existing screen share” 
            // fix : send existing producers list to client 
            const existingProducers = [];
            for(const[peerId,peer] of peers.entries()){
                if(peerId === wsId) continue;
                for(const producer of peer.producers.values()){
                    existingProducers.push({
                        producerId : producer.id,
                        peerId
                    });
                }
            }

            ws.send(JSON.stringify({ type : "existingProducers",producers : existingProducers}));

            return;
        }else if(msg.type === "createWebRtcTransport"){
            console.log(msg.type,msg.wsId);
            const wsId = msg.wsId;
            const direction = msg.direction; // send || recv
            const transport = await createWebRtcTransport();
            const peer = peers.get(wsId);
            console.log("peer",peer);
            console.log("peer transports",peer.transports);
            peer.transports.set(transport.id,{transport,direction});
            console.log('recevie transport',direction);
            console.log(peer.transports.get(transport.id));
            ws.send(JSON.stringify({ type : 'transport',peerTransport : {id : transport.id,iceCandidates : transport.iceCandidates,iceParameters : transport.iceParameters,dtlsParameters:transport.dtlsParameters}}));
            return;

        }else if(msg.type === "connectTransport"){
            console.log(msg.type,msg.wsId);
           const transportId = msg.transportId;
           const peer = peers.get(msg.wsId);
           const entry = peer.transports.get(transportId);
           const transport = entry.transport;
           await transport.connect({dtlsParameters : msg.dtlsParameters});
           ws.send(JSON.stringify({ type : "transportConnected",transportId : transport.id}));
           return;
        }else if(msg.type === "produce"){
            console.log(msg.type,msg.wsId);
            const wsId = msg.wsId;
            const transportId = msg.transportId;
            const peer = peers.get(wsId);
            const entry = peer.transports.get(transportId);
            if(entry.direction !== "send"){
                throw new Error("Cannot produce on recv transport");
            }
            const transport = entry.transport;
            const producer = await transport.produce({
                kind : msg.kind,
                rtpParameters : msg.rtpParameters
            });

            peer.producers.set(producer.id,producer);

            ws.send(JSON.stringify({ type : "produced",producerId : producer.id}));
            
            // Skip the sender and broadcast the 'newProducer' event to everyone else in the room.
            for(const[otherPeerId,otherPeer] of peers.entries()){
                if(otherPeerId === wsId) continue; // continue means go to next iteration not on next code line.

                otherPeer.socket.send(JSON.stringify({ 
                    type : "newProducer",
                    producerId : producer.id,
                    peerId : wsId
                }));
    
            }
            return;
        }else if(msg.type === "consume"){
            const wsId = msg.wsId;
            const producerId = msg.producerId;
            console.log(msg.type,msg.wsId);
            const rtpCapabilities = msg.rtpCapabilities;
            const peer = peers.get(wsId);
            console.log("peer",peer);
            const routerConsume = router.canConsume({ producerId,rtpCapabilities});
            if(!routerConsume){
                ws.send(JSON.stringify({ msg : "Router cannot Consume"}));
                return;
            };

            const transportEntries = peer.transports;
            // console.log("entries : ",transportEntries);
            let consumerTransport;
            
            for(const transportEntry of transportEntries.values()){
                // console.log("dewfewf transportEntry : ",transportEntry);
                if(transportEntry.direction === "recv"){
                    console.log("finalhere");
                    consumerTransport = transportEntry.transport;
                }
            }
            console.log('consumerTransport : ',consumerTransport);
            if(!consumerTransport){
                ws.send(JSON.stringify({ 
                    msg : "consumer transport not Found!"
                }));
                return;
            };

            const consumer = await consumerTransport.consume({producerId , rtpCapabilities,paused:true});

            peer.consumers.set(consumer.id,consumer);
            console.log('consumers list : ',peer.consumers);
            ws.send(JSON.stringify({ type : "consumerCreated",consumerParams : {id : consumer.id,producerId : consumer.producerId,kind : consumer.kind,rtpParameters : consumer.rtpParameters,transportId : consumerTransport.id}}));
            return;

            
        }else if(msg.type === "resumeConsumer"){
            const wsId = msg.wsId;
            console.log('dewddw',msg.type,msg.wsId);
            const consumerId = msg.consumerId;
            const peer = peers.get(wsId);
            const consumer = peer.consumers.get(consumerId);
            await consumer.resume();
            await consumer.requestKeyFrame();
            ws.send(JSON.stringify({ type : "consumerResumed",consumerId : consumer.id}));
            return;
        };
            
        
    });

    ws.send(JSON.stringify({success : "Socker Server Connected..!"}));
    ws.on('close',()=>{
        'Client Disconnected!...'
    });


});



