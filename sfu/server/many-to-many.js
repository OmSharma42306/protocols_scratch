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
        listenIps:[{ ip : '0.0.0.0',announcedIp : ''}],
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
            if(!router.rtpCapabilities){
                ws.send(JSON.stringify({ msg : "RouterRtpCapabilities Error"}));
                return;
            }
            const wsId = msg.wsId;
            peers.set(wsId,{socket : ws,transports : new Map(),producers : new Map(),consumers : new Map()});
            console.log(' ia m here');
            
            ws.send(JSON.stringify({type : "rtpCapabilities",rtp : router.rtpCapabilities , msg : "success"}));
            return;
        }else if(msg.type === "createWebRtcTransport"){
            const wsId = msg.wsId;
            const direction = msg.direction; // send || recv
            const transport = await createWebRtcTransport();
            const peer = peers.get(wsId);
            peer.transports.set(transport.id,{transport,direction});

            ws.send(JSON.stringify({ type : 'transport',peerTrasnport : {id : transport.id,iceCandidates : transport.iceCandidates,iceParameters : transport.iceParameters,dtlsParameters:transport.dtlsParameters}}));
            return;

        }else if(msg.type === "connectTransport"){
           const transportId = msg.transportId;
           const peer = peers.get(msg.wsId);
           const entry = peer.transports.get(transportId);
           const transport = entry.transport;
           await transport.connect({dtlsParameters : msg.dtlsParameters});
           ws.send(JSON.stringify({ type : "transportConnected",transportId : transport.id}));
           return;
        }else if(msg.type === "produce"){
            const wsId = msg.wsId;
            const transportId = msg.trasportId;
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
            const rtpCapabilities = msg.rtpCapabilities;
            const peer = peers.get(wsId);
            const routerConsume = router.canConsume({ producerId,rtpCapabilities});
            if(!routerConsume){
                ws.send(JSON.stringify({ msg : "Router cannot Consume"}));
                return;
            };

            const transportEntries = peer.transports;
            let consumerTransport;

            for(const transportEntry of transportEntries.values()){
                if(transportEntry.direction === "recv"){
                    
                    consumerTransport = transportEntry.transport;
                }
            }
            if(!consumerTransport){
                ws.send(JSON.stringify({ 
                    msg : "consumer transport not Found!"
                }));
                return;
            };

            const consumer = await consumerTransport.consume({producerId , rtpCapabilities,paused:true});

            peer.consumers.set(consumer.id,consumer);
            ws.send(JSON.stringify({ type : "consumerCreated",consumerParams : {id : consumer.id,producerId : consumer.producerId,kind : consumer.kind,rtpParameters : consumer.rtpParameters,transportId : consumerTransport.id}}));
            return;

            
        }else if(msg.type === "resumeConsumer"){
            const wsId = msg.wsId;
            const consumerId = msg.consumerId;
            const peer = peers.get(wsId);
            const consumer = peer.consumers.get(consumerId);
            await consumer.resume();
            ws.send(JSON.stringify({ type : "consumerResumed",consumerId : consumer.id}));
            return;
        };
            
        
    });

    ws.send("Socker Server Connected..!");
    ws.on('close',()=>{
        'Client Disconnected!...'
    });


});



