import mediasoup from "mediasoup";
import { WebSocketServer } from "ws";


let worker, router,producerTransport;
const wss = new WebSocketServer({ port : 8080});

(async ()=>{
    worker = await mediasoup.createWorker();
    router = await worker.createRouter({mediaCodecs:[
        {kind : 'video',mimeType:'video/VP8',clockRate:90000}
    ]});
    
    // const r = await router.createWebRtcTransport({
    //     enableTcp : true,
    //     enableUdp : true,
    //     preferUdp : true
    // });

    // {
    //     r.id,
    //     r.iceCandidates,
    //     r.iceParameters,
    //     r.dtlsParameters
    // }
    

    

    console.log('mediasoup router created',router.rtpCapabilities)
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
            return;

        }else if(msg.action === "createWebRtcTransport"){
            if(msg.direction === "send"){
                producerTransport = await createTransport();
                console.log("***********************************************")
                console.log(producerTransport.iceCandidates);

                console.log("***********************************************")
                ws.send(JSON.stringify({ type : 'producerTransport','producerTransport':  {"id" : producerTransport.id,
    "iceCandidates" : producerTransport.iceCandidates,
    "iceParameters" : producerTransport.iceParameters,
    "dtlsParameters": producerTransport.dtlsParameters,
}}));
                return;
            }
        }
        
    });
    ws.on('close',()=>{console.log("Client Disconnected>..")});

});



async function createTransport(){
    const transport = await router.createWebRtcTransport({
        listenIps:['0.0.0.0'],
        enableTcp : true,
        enableUdp : true,
        preferUdp : true
        
   });

   console.log('Transport',transport);

//    {
//     "id" : transport.id,
//     "iceCandidates " : transport.iceCandidates,
//     "iceParameters" : transport.iceParameters,
//     "dtlsParameters : transport.dtlsParameters,
//     "routerRtpCapabilities ": router.rtpCapabilities

//    }
    
    return transport;

}