import { socket } from "./sockets/sockets";
import { Device } from "mediasoup-client";

let device,pendingCallbackConnectTransport,pendingConsumeCallback;

// transports
let consumerTransport;
export default function Receiver(){
    
    socket.onmessage = async(event) =>{
        const msg = JSON.parse(event.data);

        if(msg.type === "RTPCAPABILITIES"){
            console.log('consumer setting...');
            if(!device) device = new Device();
            await device.load({ routerRtpCapabilities : msg.rtp});

            console.log("done setting up device");
            socket.send(JSON.stringify({ action : "createWebRtcTransport",direction : "recv"}));
        }else if(msg.type === "consumerTransport"){
            console.log("Consumer Transport : ",msg.consumerTransport);
            if(device){
                consumerTransport = device.createRecvTransport(msg.consumerTransport);

                consumerTransport.on("connect",({dtlsParameters},callback)=>{
                    socket.send(JSON.stringify({ role : "consumer",action:"connectTransport","dtlsParameters":dtlsParameters,transportId:consumerTransport.id }));
                    pendingCallbackConnectTransport = callback;
                });

                consumerTransport.on("consume",({kind,rtpParameters},callback)=>{

                })
            }
        }else if(msg.type === "transportConnected"){
            pendingCallbackConnectTransport();
        }else if(msg.type === "newProducer"){
            //When consumer receives "newProducer", it must request consume:
            socket.send(JSON.stringify({ action : "consume",transportId : consumerTransport.id,producerId:msg.producerId, "rtpCapabilities": device.rtpCapabilities}))
        }
    }

  

    function handleJoinRoomConsumer(){
        socket.send(JSON.stringify({  type : 'client-joined',role : "consumer"}));    
    }

    return <div>
        <h1>Receiver Screen.</h1>
        <br />
        <button onClick={handleJoinRoomConsumer}>Join Room</button>
    </div>
}