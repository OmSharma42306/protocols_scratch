import mediasoup from "mediasoup";
import { WebSocketServer } from "ws";

let worker, router;

// transport roles
let producerTransport,consumerTransport;

// socket roles
let producerSocket,consumerSocket;

// consumer..
let consumer;

const wss = new WebSocketServer({ port : 8080});

(async ()=>{
    worker = await mediasoup.createWorker();
    router = await worker.createRouter({mediaCodecs:[
        {kind : 'video',mimeType:'video/VP8',clockRate:90000}
    ]});

})();

wss.on('connection',function connection(ws){
    console.log('i am inside socket server...');

    ws.on('message',async function message(message){
        console.log(message.toString());
        const msg = JSON.parse(message);
        
        if(msg.type === "client-joined"){
            if(!router.rtpCapabilities){
                console.error('Router RTP Capabilities not available!');
                ws.send(JSON.stringify({msg:"Router RTPCAPBILITIES ERROR!"}));
                return;
            }            
            ws.send(JSON.stringify({  "type": "RTPCAPABILITIES","rtp": router.rtpCapabilities}));
            console.log("sent");
            const role = msg.role;
            if(role === "producer"){
                producerSocket = ws;
            }else if(role === "consumer"){
                consumerSocket = ws;
            }
            return;

        }else if(msg.action === "createWebRtcTransport"){
            if(msg.direction === "send"){
                producerTransport = await createTransport();
                console.log("***********************************************")
                // console.log(producerTransport.iceCandidates);

                console.log("***********************************************")
                producerSocket?.send(JSON.stringify({ type : 'producerTransport',producerTransport:  {"id" : producerTransport.id,
    "iceCandidates" : producerTransport.iceCandidates,
    "iceParameters" : producerTransport.iceParameters,
    "dtlsParameters": producerTransport.dtlsParameters,
}}));
                return;
            }else if(msg.direction === "recv"){
                consumerTransport = await createTransport();
                console.log("########################");
                console.log(consumerSocket.iceCandidates);
                console.log("########################");
                consumerSocket.send(JSON.stringify({ type : 'consumerTransport',consumerTransport:{ "id" : consumerTransport.id,
                    "iceCandidates":consumerTransport.iceCandidates,
                    "iceParameters":consumerTransport.iceParameters,
                    "dtlsParameters":consumerTransport.dtlsParameters
                }}));
                return;

            }
        }else if(msg.action === "connectTransport"){
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
                return;
            }
            

        }else if(msg.action === "produce"){
            console.log("2 fired.")
            const producer = await producerTransport.produce({
                kind : msg.kind,
                rtpParameters : msg.rtpParameters
            });
            producerSocket.send(JSON.stringify({
    type: "produced",
    producerId: producer.id
  }));
consumerSocket.send(JSON.stringify({
    type : "newProducer",
    producerId : producer.id
}));
        }else if(msg.action === "consume"){
            let producerId = msg.producerId;
            let rtpCapabilities = msg.rtpCapabilities;
            let routerConsume = router.canConsume({producerId,rtpCapabilities});
            if(!routerConsume){
                consumerSocket.send(JSON.stringify({ msg : "Router Cannot Consume " }));
                return; 
            };

            consumer = await consumerTransport.consume({ producerId,rtpCapabilities,paused:true});
            consumer.on("transportclose", () => console.log("consumer transport closed"));
        consumer.on("producerclose", () => console.log("producer closed"));
            console.log("consumer paused:", consumer.paused);

            console.log("Consumer: ",consumer);
            consumerSocket.send(JSON.stringify({ type : "consumerCreated",consumerParams:{
                id : consumer.id, producerId : consumer.producerId,kind : consumer.kind,rtpParameters : consumer.rtpParameters,transportId : consumerTransport.id

            } }));
            console.log("sent message consumer side......");
            return;

        }else if(msg.action === "resumeConsumer"){
            await consumer.resume();
            console.log("consumer paused:", consumer.paused);

            consumerSocket.send(JSON.stringify({ type : "consumerResumed",consumerId : consumer.id}));
            return;
        }
        
    });
    ws.on('close',()=>{console.log("Client Disconnected>..")});

});



async function createTransport(){
    const transport = await router.createWebRtcTransport({
        listenIps:[{ip : '0.0.0.0',announcedIp : '192.168.31.59'}],
        enableTcp : true,
        enableUdp : true,
        preferUdp : true,
        
        
   });

//    console.log('Transport',transport);

//    {
//     "id" : transport.id,
//     "iceCandidates " : transport.iceCandidates,
//     "iceParameters" : transport.iceParameters,
//     "dtlsParameters : transport.dtlsParameters,
//     "routerRtpCapabilities ": router.rtpCapabilities

//    }
    
    return transport;
}