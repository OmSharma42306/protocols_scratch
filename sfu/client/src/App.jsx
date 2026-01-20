import { socket } from "./sockets/sockets"
import {Device} from "mediasoup-client"
let device , sendTransport;

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
      console.log("send transport set",sendTransport);
      }
      
    }
    console.log(msg);
  }
  function handleJoinRoom(){
    socket.send(JSON.stringify({ type : 'client-joined'}))
  }

  if(sendTransport){
    sendTransport.on("connect", ({ dtlsParameters }, callback) => {
    console.log("hey boy",dtlsParameters);
})
  }
  

  
  return <div>
    <button onClick={handleJoinRoom}>Join Room 123</button>
  </div>
}