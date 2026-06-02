import { useRef, useState } from "react";
import axios from "axios";

function LiveCamera() {
  const [ascii, setAscii] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      videoRef.current.srcObject = stream;
    } catch (error) {
      console.error(error);
      alert("Unable to access camera");
    }
  };

  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video.videoWidth) {
      alert("Start camera first!");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/png");

    setSnapshot(imageData);
  };

  const convertSnapshot = async () => {
    const canvas = canvasRef.current;

    canvas.toBlob(async (blob) => {
      try {
        const formData = new FormData();

        formData.append(
          "file",
          blob,
          "snapshot.png"
        );

        formData.append(
          "width",
          120
        );

        const response = await axios.post(
          "http://127.0.0.1:8000/convert-image",
          formData
        );

        setAscii(response.data.ascii);

      } catch (error) {
        console.error(error);
        alert("ASCII conversion failed");
      }
    }, "image/png");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "20px",
      }}
    >
      <h1>Live Camera ASCII</h1>

      <button onClick={startCamera}>
        Start Camera
      </button>

      <button
        onClick={takeSnapshot}
        style={{ marginLeft: "10px" }}
      >
        Capture Frame
      </button>

      <button
        onClick={convertSnapshot}
        style={{ marginLeft: "10px" }}
      >
        Convert Snapshot
      </button>

      <br /><br />

      <video
        ref={videoRef}
        autoPlay
        width="600"
      />

      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />

      {snapshot && (
        <>
          <h2>Captured Frame</h2>

          <img
            src={snapshot}
            width="500"
            alt="snapshot"
          />
        </>
      )}

      {ascii && (
        <>
          <h2>ASCII Result</h2>

          <pre
            style={{
              background: "black",
              color: "#00ff00",
              padding: "20px",
              overflow: "auto",
              whiteSpace: "pre",
              fontSize: "8px",
              lineHeight: "8px",
              fontFamily: "Courier New",
              width: "95%",
              margin: "auto",
            }}
          >
            {ascii}
          </pre>
        </>
      )}
    </div>
  );
}

export default LiveCamera;