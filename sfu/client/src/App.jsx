import { Route,Routes } from "react-router-dom";
import Sender from "./Sender";
import Receiver from "./Receiver";

export default function App(){

  

  return <div>
    <h1>Welcome to SFU</h1>
    <br />
    <Routes>
      <Route path="/sender" element={<Sender/>}></Route>
      <Route path="/receiver" element={<Receiver/>}></Route>
    </Routes>
  </div>
}