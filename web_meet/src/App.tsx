import React, { useState } from "react";
import "./App.css";
import { useNavigate } from "react-router-dom";
import pexels from "./Assets/pexels.jpg";

function App() {
  const [room, setRoom] = useState<any>("");
  const [user, setUser] = useState<any>("");
  const navigate = useNavigate();
  return (
    <div
      // className="App"
      style={{
        backgroundImage: `url(${pexels})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="main1">
        <div>
          <div
            style={{
              width: "20rem",
              backgroundColor: "black",
              height: "100vh",
            }}
          >
            <h1 className="main-text">Lets Exercise !</h1>
            <div className="container">
              <div className="input">
                <p
                  style={{
                    color: "white",
                    marginRight: "2.5rem",
                    fontSize: "18px",
                    fontWeight: "bold",
                  }}
                >
                  User:
                </p>
                <input
                  type="text"
                  // placeholder="Enter your name"
                  onChange={(e) => setUser(e.target.value)}
                />
              </div>
              <div className="input2">
                <p
                  style={{
                    color: "white",
                    marginRight: "1rem",
                    fontSize: "18px",
                    fontWeight: "bold",
                  }}
                >
                  Room No:
                </p>
                <input
                  value={room}
                  type="text"
                  placeholder=""
                  onChange={(e) => {
                    setRoom(e.target.value);
                  }}
                />
              </div>
              <div>
                <button
                  className="join-btn"
                  onClick={() =>
                    navigate(`/room/${user}/${room}`, {
                      state: { room, user },
                    })
                  }
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
