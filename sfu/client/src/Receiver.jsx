    import { useEffect, useRef } from "react";
    import { socket } from "./sockets/sockets";
    import { Device } from "mediasoup-client";

    let device,pendingCallbackConnectTransport,pendingConsumeCallback;

    // transports
    let consumerTransport;
    export default function Receiver(){
        const videoRef = useRef();    
        useEffect(()=>{
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
                    
                    consumerTransport.on("connectionstatechange", (state) => {
                        console.log("consumerTransport state:", state);
                    });
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
            }else if(msg.type === "consumerCreated"){
                const consumer = await consumerTransport.consume(msg.consumerParams);
                const track = consumer.track;
                console.log("track kind:", track.kind, "readyState:", track.readyState);
                const stream = new MediaStream([track]);
                console.log("stream : ",stream)
                if(videoRef.current){
                videoRef.current.srcObject = stream;
                console.log("video srcObject set:", videoRef.current.srcObject);
                    


                }
                
                
                socket.send(JSON.stringify({ "action":"resumeConsumer","consumerId":consumer.id}))
            }else if(msg.type === "consumerResumed"){
                if(videoRef.current)    {
                    videoRef.current.onloadedmetadata = () => console.log("metadata loaded");
                    // await videoRef.current.play();
                    try {
  await videoRef.current.play();
  console.log("play() success");
} catch (e) {
  console.log("play() failed:", e);
}
                    console.log("video paused:", videoRef.current.paused);
console.log("video readyState:", videoRef.current.readyState);

                    
                }
                
            }
        }
        },[])
   
    
        
    

        function handleJoinRoomConsumer(){
            socket.send(JSON.stringify({  type : 'client-joined',role : "consumer"}));    
        }

        return <div>
            <h1>Receiver Screen.</h1>
            <br />
            <button onClick={handleJoinRoomConsumer}>Join Room</button>
            <br />
            <h1>video ;;;</h1>
            {/* <video ref={videoRef} muted autoPlay playsInline></video> */}
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "600px", border: "1px solid red" }} />

        </div>
    }