import React, { useEffect, useRef } from "react";
import { CiMicrophoneOn, CiMicrophoneOff } from "react-icons/ci";

interface VideoProps {
  stream: MediaStream;
  userName?: string;
  width?: any;
  height?: any;
  left?: any;
  top?: any;
  remote?: any;
  kind?: "video" | "audio";
  isVideo?: boolean;
  isAudio?: boolean;
}

const Video = ({
  stream,
  userName,
  height,
  left,
  top,
  width,
  remote,
  kind,
  isAudio,
  isVideo,
}: VideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [videoRef.current, stream]);

  return (
    <>
      <span
        style={{
          inset: 0,
          display: "block",
          position: "absolute",
          zIndex: 11,
          backgroundImage:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, .8))",
        }}
      />
      {/* microphone indicator */}

      <div
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          color: "white",
          zIndex: 999999999,
        }}
      >
        {isAudio ? <CiMicrophoneOn /> : <CiMicrophoneOff />}
      </div>
      <div />
      {!isVideo && (
        <div
          style={{
            width,
            height,
            top,
            left,
            position: "absolute",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
            backgroundColor: "black",
          }}
        >
          <div
            style={{
              backgroundColor: "#2176ff",
              borderRadius: "50%",
              height: "8rem",
              width: "8rem",
              border: "2px solid white",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontWeight: "bold",
              color: "white",
              textTransform: "capitalize",
            }}
          >
            {!remote ? "You" : userName?.substring(0, 2)}
          </div>
        </div>
      )}
      {kind === "video" ? (
        <video
          style={{
            // objectFit: "cover",
            width,
            height,
            top,
            left,
          }}
          muted={remote ? false : true}
          autoPlay
          playsInline
          ref={videoRef}
        />
      ) : (
        <audio ref={videoRef} autoPlay playsInline></audio>
      )}
    </>
  );
};

export default Video;
