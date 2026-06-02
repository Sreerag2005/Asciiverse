import matrixBg from "../assets/matrix-home.jpg";

function Home() {
  const buttonStyle = {
    background: "#111",
    color: "#39ff14",
    border: "1px solid #39ff14",
    padding: "12px 25px",
    margin: "10px",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 0 10px #39ff14",
    fontSize: "16px",
    fontWeight: "bold",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${matrixBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",

        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Dark Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          color: "white",
        }}
      >
        <h1
          style={{
            fontSize: "6rem",
            color: "#39ff14",
            textShadow:
              "0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14",
            marginBottom: "20px",
          }}
        >
          ASCIIVERSE
        </h1>

        <p
          style={{
            fontSize: "1.5rem",
            marginBottom: "40px",
          }}
        >
          Transform Reality Into ASCII Art
        </p>

        <a href="/image">
          <button style={buttonStyle}>
             Image to ASCII
          </button>
        </a>

               <a href="/live-ascii">
          <button style={buttonStyle}>
             Cyberpunk ASCII Camera
          </button>
        </a>
      </div>
    </div>
  );
}

export default Home;