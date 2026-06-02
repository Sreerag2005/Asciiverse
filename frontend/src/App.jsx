import { BrowserRouter, Routes, Route } from "react-router-dom";
import LiveAsciiCamera from "./pages/LiveAsciiCamera";
import Home from "./pages/Home";
import ImageToAscii from "./pages/ImageToAscii";
import LiveCamera from "./pages/LiveCamera";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Home />} />

        <Route
          path="/image"
          element={<ImageToAscii />}
        />

        <Route
          path="/camera"
          element={<LiveCamera />}
        />

        <Route
          path="/live-ascii"
          element={<LiveAsciiCamera />}
        />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;