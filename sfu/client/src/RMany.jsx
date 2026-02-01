import { useEffect, useState } from "react";
import { socket } from "./sockets/sockets";
import { Device } from "mediasoup-client";
import { useRef } from "react";

let device;

// transports
let consumerTransport;

// callbacks
let consumerTransportPendingCallback;



// queue stuff
let pendingProducers = new Set();
let deviceLoaded = false;
let transportReady = false;

export default function RMany(){
    const [wsId,setWsId] = useState('');
    const videoRef = useRef();
    // setting an consumers state to show multiple grid layouts of producers.
    const [consumers,setConsumers] = useState({});
    // format...
    // {
    //     producerId : {consumer,stream}
    // }
    useEffect(()=>{
        socket.onmessage = async(event) =>{
        const msg = JSON.parse(event.data);
        if(msg.type === "rtpCapabilities"){
            console.log("consumer setting...")
            if(!device) device = new Device();
            await device.load({ routerRtpCapabilities : msg.rtp});
            deviceLoaded = true;
            console.log("router rtpcapabilties loaded.....")
            socket.send(JSON.stringify({ type : "createWebRtcTransport",wsId : wsId,direction : "recv"}));
        }else if(msg.type === "transport"){
            if(device){
                consumerTransport = device.createRecvTransport(msg.peerTransport);
                console.log("consumer transport createad....");
                 flushPending();
            console.log("flushpending() ran");
            console.log(`variable stats ,Transport ready : ${transportReady} and device loaded${deviceLoaded} ` )
                // consumerTransport events...
                consumerTransport.on("connect",({dtlsParameters},callback)=>{
                    console.log("inside here!");
                    socket.send(JSON.stringify({ type : "connectTransport",transportId:consumerTransport.id,wsId:wsId,dtlsParameters : dtlsParameters}))
                    consumerTransportPendingCallback = callback;
                   
                });

            }
        }else if(msg.type === "transportConnected"){
            consumerTransportPendingCallback();
             transportReady = true;
            //  flushPending();
            console.log("transport connected..!");
        }else if(msg.type === "newProducer"){
            console.log("new producer logs");
            socket.send(JSON.stringify({ type : "consume",wsId : wsId,producerId:msg.producerId,rtpCapabilities : device.rtpCapabilities}));
            // requestConsume(msg.producerId);
        }else if(msg.type === "existingProducers"){
            console.log(" i am at existingProducers....");
            const p = msg.producers;
            console.log(p);
            
            p.forEach(prod=>{
                // socket.send(JSON.stringify({ type : "consume",wsId : wsId,producerId : prod.producerId,rtpCapabilities : device.rtpCapabilities}))
                requestConsume(prod.producerId);
            })
            
            

        }else if(msg.type === "consumerCreated"){
            const consumer = await consumerTransport.consume(msg.consumerParams);
            console.log('consumer created...');
           
            const track = consumer.track;
            const stream = new MediaStream([track]);
            // we get producerId from consumerParams.producerId;
            setConsumers(prev=>({
                ...prev,
                [msg.consumerParams.producerId ] : {consumer,stream}
            }));
            console.log(stream);
            console.log("track",track);
            // if(videoRef.current){
            //     videoRef.current.srcObject = stream;
            // }

            socket.send(JSON.stringify({ type : "resumeConsumer",wsId:wsId,consumerId : consumer.id}));
            console.log("message sent");
        }else if(msg.type === "consumerResumed"){
            console.log("ker")
            if(videoRef.current){
                try{
                    console.log("ker2")
                    await videoRef.current.play();
                    console.log("play() success");
            }catch(error){
                console.log("play() failed",error);
            }
            }
        }
    }

    },[wsId])
        
    function handleJoinRoom(){
        socket.send(JSON.stringify({ type : 'client-join',wsId:wsId }));
    }

    function requestConsume(producerId){
        if(!deviceLoaded || !consumerTransport){
            pendingProducers.add(producerId);
            console.log(" i am adding producers",pendingProducers);
            console.log("added");
            return;
        }
        socket.send(JSON.stringify({
        type : "consume",
        wsId : wsId,
        producerId,
        rtpCapabilities : device.rtpCapabilities
    }));
    console.log("message sent omya ...");
    }
    function flushPending(){
        pendingProducers.forEach(id=>requestConsume(id));
        pendingProducers.clear();
    }
    return <div>
        <h1>Enter RoomId</h1>
        <br />
        <input type="text" onChange={(e)=>{setWsId(e.target.value)}} />
        <br />
        <button onClick={handleJoinRoom}>Join Room</button>
        <br />
            <h1>video ;;;</h1>
            {/* <video ref={videoRef} muted autoPlay playsInline></video> */}
            {/* <video ref={videoRef} autoPlay playsInline muted style={{ width: "600px", border: "1px solid red" }} /> */}

            <div className="grid">
                {Object.entries(consumers).map(([producerId,data])=>{
                    console.log("finally",producerId,data);
                    return <Videotile key={producerId} stream={data.stream}/>
                    
                })}
            </div>
    </div>
}


function Videotile({stream}){
    const ref = useRef(null);

    useEffect(()=>{
        if(ref.current && !ref.current.srcObject){
            ref.current.srcObject = stream;
        }
    },[stream])

    return(
        <video ref={ref} autoPlay playsInline muted  style={{ width: "100%", border: "1px solid #444" }}></video>
    )
}