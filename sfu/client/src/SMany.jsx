import { useEffect } from "react";
import { socket } from "./sockets/sockets";
import { Device } from "mediasoup-client";
import { useState } from "react";
let device;

// transports

let sendTransport;

// pending-callbacks

let transportConnectPendingCallback,producerConnectPendingCallback;


export default function SMany(){
    const [wsId,setWsId] = useState();
    useEffect(()=>{
        socket.onmessage = async (event) =>{
        console.log(event);
        console.log(event.data);
        const msg = JSON.parse(event.data);
        console.log(msg);
        if(msg.type === 'rtpCapabilities'){
            if(!device) device = new Device();
            await device.load({routerRtpCapabilities : msg.rtp});
            socket.send(JSON.stringify({ type : "createWebRtcTransport",wsId : wsId,direction : "send"}));
        }else if(msg.type === "transport"){
            console.log("dew",msg.peerTransport);
            if(device){
                sendTransport = device.createSendTransport(msg.peerTransport);
                

                // event listenrs on sendTransport.
                sendTransport.on('connect',({dtlsParameters},callback)=>{
                    console.log("heyboy",dtlsParameters);
                    socket.send(JSON.stringify({type : "connectTransport",wsId : wsId,transportId : sendTransport.id,dtlsParameters : dtlsParameters}));
                    // handleconnectTransport
                    transportConnectPendingCallback = callback;
                });

                // produce events 
                sendTransport.on('produce',({kind,rtpParameters},callback)=>{
                    console.log("000000")
                    socket.send(JSON.stringify({ type : "produce",wsId : wsId,transportId : sendTransport.id,kind : kind,rtpParameters:rtpParameters}));

                    // handlePendingProduce
                    producerConnectPendingCallback = callback;

                });

                // all above events will be triggerd when you 
                // get video tracks and audio track from navigator mediadevices.

                const stream = await navigator.mediaDevices.getDisplayMedia({video : true,audio : true});
                const track = stream.getVideoTracks()[0];
                console.log("33333")
                await sendTransport.produce({track});
                console.log("33333")
                console.log("all send transport stuff done",sendTransport);
            }
            
        }else if(msg.type === "transportConnected"){
            console.log("1111")
            transportConnectPendingCallback();
        }else if(msg.type === "produced"){
            console.log("2222")
            producerConnectPendingCallback({id : msg.producerId});
        }
    }

    },[wsId])
    
    function handleJoinRoom(){
        socket.send(JSON.stringify({type : "client-join",wsId:wsId}))
    }
    return <div>
        <h1>Enter Roomod</h1>
        <br />
        <input type="text" onChange={(e)=>{setWsId(e.target.value)}} />
        <br />
        <button onClick={handleJoinRoom}>Join Room</button>
    </div>
}