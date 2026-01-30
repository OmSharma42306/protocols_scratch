import { useEffect } from "react";
import { socket } from "./sockets/sockets";
import { Device } from "mediasoup-client";
import { useRef } from "react";

let device;

// transports
let consumerTransport;

// callbacks
let consumerTransportPendingCallback;
export default function RMany(){
    const videoRef = useRef();
    socket.onmessage = async(event) =>{
        const msg = JSON.parse(event.data);
        if(msg.type === "rtpCapabilities"){
            console.log("consumer setting...")
            if(!device) device = new Device();
            await device.load({ routerRtpCapabilities : msg.rtp});
            console.log("router rtpcapabilties loaded.....")
            socket.send(JSON.stringify({ type : "createWebRtcTransport",wsId : "321",direction : "recv"}));
        }else if(msg.type === "transport"){
            if(device){
                consumerTransport = device.createRecvTransport(msg.peerTransport);
                console.log("consumer transport createad....");
                // consumerTransport events...
                consumerTransport.on("connect",({dtlsParameters},callback)=>{
                    console.log("inside here!");
                    socket.send(JSON.stringify({ type : "connectTransport",transportId:consumerTransport.id,wsId:"321",dtlsParameters : dtlsParameters}))
                    consumerTransportPendingCallback = callback;
                });

            }
        }else if(msg.type === "transportConnected"){
            consumerTransportPendingCallback();
            console.log("transport connected..!");
        }else if(msg.type === "newProducer"){
            console.log("new producer logs");
            socket.send(JSON.stringify({ type : "consume",wsId : "321",producerId:msg.producerId,rtpCapabilities : device.rtpCapabilities}));
        }else if(msg.type === "consumerCreated"){
            const consumer = await consumerTransport.consume(msg.consumerParams);
            console.log('consumer created...');
            const track = consumer.track;
            const stream = new MediaStream([track]);
            console.log(stream);
            if(videoRef.current){
                videoRef.current.srcObject = stream;
            }
            socket.send(JSON.stringify({ type : "resumeConsumer",wsId:"321",consumerId : consumer.id}));
        }else if(msg.type === "consumerResumed"){
            if(videoRef.current){
                try{
                    await videoRef.current.play();
                    console.log("play() success");
            }catch(error){
                console.log("play() failed",error);
            }
            }
        }
    }
    
    function handleJoinRoom(){
        socket.send(JSON.stringify({ type : 'client-join',wsId:"321" }));
    }
    return <div>
        <button onClick={handleJoinRoom}>Join Room</button>
        <br />
            <h1>video ;;;</h1>
            {/* <video ref={videoRef} muted autoPlay playsInline></video> */}
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "600px", border: "1px solid red" }} />
    </div>
}