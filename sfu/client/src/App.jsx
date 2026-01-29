import { Route,Routes } from "react-router-dom";
import Sender from "./Sender";
import Receiver from "./Receiver";
import SMany from "./SMany";
import RMany from "./RMany";

export default function App(){

  

  return <div>
    <h1>Welcome to SFU</h1>
    <br />
    <Routes>
      <Route path="/sender" element={<Sender/>}></Route>
      <Route path="/receiver" element={<Receiver/>}></Route>
      <Route path="/smany" element={<SMany/>}></Route>
      <Route path="/rmany" element={<RMany/>}></Route>
    </Routes>
  </div>
}