import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { io } from "socket.io-client";
import * as mediaSoupClient from "mediasoup-client";
import { RtpCapabilities, Device } from "mediasoup-client/lib/types";
import { v4 as uuidv4 } from "uuid";
import { useLocation, useParams } from "react-router-dom";
import initLayoutContainer from "opentok-layout-js";
import {
  CiVideoOn,
  CiVideoOff,
  CiMicrophoneOn,
  CiMicrophoneOff,
} from "react-icons/ci";
import Video from "./Video";

const socket = io(
  "https://b3fd-2405-201-4018-9231-e1fc-e077-b362-9a1f.ngrok-free.app", //---3000port
  {
    extraHeaders: {
      "ngrok-skip-browser-warning": "false",
    },
  }
);
const socket2 = io(
  "https://0edf-2405-201-4018-9231-718c-b57-8165-95ed.ngrok-free.app",
  {
    path: "/ws/socket.io",
    extraHeaders: {
      "ngrok-skip-browser-warning": "true",
    },
  }
);
let params: any = {
  // mediasoup params
  encodings: [
    {
      rid: "r0",
      maxBitrate: 100000,
      scalabilityMode: "S1T3",
    },
    {
      rid: "r1",
      maxBitrate: 300000,
      scalabilityMode: "S1T3",
    },
    {
      rid: "r2",
      maxBitrate: 900000,
      scalabilityMode: "S1T3",
    },
  ],
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
  codecOptions: {
    videoGoogleStartBitrate: 1000,
  },
};

const Room = () => {
  let ref = useRef<HTMLVideoElement>(null);

  let rtpCapabilities = useRef<RtpCapabilities>();
  let deviceRef = useRef<Device>();

  let canvasRef = useRef<HTMLCanvasElement>(null);
  let producerTransport = useRef<any>();
  const [consumerTransports, setConsumerTransports] = useState<any>([]);
  const [userId, setUserId] = useState(uuidv4());
  const [countFrames, setCountFrames] = useState(0);
  const location = useLocation();
  const paramId = useParams();

  let videoProducer = useRef<any>();
  let audioProducer = useRef<any>();

  const remoteProducersRef = useRef<any[]>([]);

  let consumerRef = useRef<any>();

  let audioParams = useRef<any>();
  let videoParams = useRef<any>(params);
  let [consumingTransport, setConsumingTransport] = useState<any>([]);
  let disabledVideo = useRef<any>(false);

  const [roomName, setRoomName] = useState<any>("room1");
  const [count, setCount] = useState<any>(0);
  const exerciseRef = useRef(count);
  const exerciseNameRef = useRef("");
  const [exerciseName, setExerciseName] = useState("Jumping Jacks");
  const layoutRef = useRef<any>();
  const [forceUpdate, setForceUpdate] = useState(false);
  const intervalId = useRef<any>();
  const [streams, setStreams] = useState<any[]>([]);
  const [layoutStreams, setLayoutStreams] = useState<any[]>([]);

  useEffect(() => {
    if (location.state) {
      setRoomName(location.state.room);
    }
  }, [location]);

  useEffect(() => {
    getLocalStream();
  }, []);

  useEffect(() => {
    if (ref.current) {
      ref.current.addEventListener("loadedmetadata", () => {
        canvasRef.current!.height = ref.current!.videoHeight;
        canvasRef.current!.width = ref.current!.videoWidth;
      });
    }
  }, [ref.current]);

  useLayoutEffect(() => {
    socket2.on("capture_frames", (data: any) => {
      console.log(data, "dataaa");
      setCount(data.count);
      exerciseRef.current! = data.count;
      exerciseNameRef.current! = data.type;
      setExerciseName(data.type);
    });
  }, [socket2]);

  useEffect(() => {
    socket2.on("success", () => {
      console.log("connected");
    });
  }, []);

  // for updating the ui of others when current user paused their video/audio
  const videoResumed = ({ userName }: any) => {
    // update the ui of others when current user paused their video
    const updatedStreams = streams.map((stream) => {
      if (stream?.userName === userName) {
        return {
          ...stream,
          isVideo: true,
        };
      }
      return stream;
    });

    setStreams(updatedStreams);
  };
  const videoPaused = ({ userName }: any) => {
    // update the ui of others when current user paused their video
    const updatedStreams = streams.map((stream) => {
      console.log(stream, "st");
      if (stream?.userName === userName) {
        return {
          ...stream,
          isVideo: false,
        };
      }
      return stream;
    });
    console.log(updatedStreams);

    setStreams(updatedStreams);
  };
  const audioResumed = ({ userName }: any) => {
    // update the ui of others when current user paused their audio
    const updatedStreams = streams.map((stream) => {
      if (stream?.userName === userName) {
        return {
          ...stream,
          isAudio: true,
        };
      }
      return stream;
    });

    setStreams(updatedStreams);
  };
  const audioPaused = ({ userName }: any) => {
    // update the ui of others when current user paused their audio
    const updatedStreams = streams.map((stream) => {
      console.log(stream, "st");
      if (stream?.userName === userName) {
        return {
          ...stream,
          isAudio: false,
        };
      }
      return stream;
    });
    console.log(updatedStreams);

    setStreams(updatedStreams);
  };

  const handleNewProducer = ({ producerId }: any) => {
    signalNewConsumerTransport(producerId);
  };

  const handleProducerClosed = ({ remoteProducerId, userName }: any) => {
    try {
      const producerclose = consumerTransports.find((transportData: any) => {
        return transportData.producerId === remoteProducerId;
      });
      producerclose?.consumerTransports?.close();
      producerclose?.consumer?.close();
      let consumerFilterTransport = consumerTransports.filter(
        (transportData: any) => {
          return transportData.producerId !== remoteProducerId;
        }
      );

      setConsumerTransports(consumerFilterTransport); //todo remove from ui
    } catch (error) {
      console.log(error);
    }
  };

  const removeUser = ({ userName }: any) => {
    const filterUser = streams.filter((streamData: any) => {
      return streamData.userName !== userName;
    });
    setStreams(filterUser);
  };

  useEffect(() => {
    socket.on("video-paused", videoPaused);
    socket.on("video-resumed", videoResumed);
    socket.on("audio-paused", audioPaused);
    socket.on("audio-resumed", audioResumed);

    socket.on("new-producer", handleNewProducer);
    socket.on("producer-closed", handleProducerClosed);
    socket.on("user-disconnected", removeUser);

    return () => {
      socket.removeListener("video-paused", videoPaused);
      socket.removeListener("video-resumed", videoResumed);
      socket.removeListener("audio-paused", audioPaused);
      socket.removeListener("audio-resumed", audioResumed);
      socket.removeListener("new-producer", handleNewProducer);
      socket.removeListener("producer-closed", handleProducerClosed);
    };
  }, [videoPaused, videoResumed, audioPaused, audioResumed, removeUser]);

  // setting up opentoklayout
  useEffect(() => {
    layoutRef.current = initLayoutContainer(
      document.getElementById("container") as any,
      {
        containerWidth: window.innerWidth,
        containerHeight: window.innerHeight,
        maxRatio: 3 / 2, // The narrowest ratio that will be used (default 2x3)
        minRatio: 9 / 16, // The widest ratio that will be used (default 16x9)
        fixedRatio: false, // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
        fixedRatioClass: "OT_fixedRatio", // The class to add to elements that should respect their native aspect ratio
        scaleLastRow: true, // If there are less elements on the last row then we can scale them up to take up more space
        alignItems: "center", // Can be 'start', 'center' or 'end'. Determines where to place items when on a row or column that is not full
        bigClass: "OT_big", // The class to add to elements that should be sized bigger
        bigPercentage: 0.8, // The maximum percentage of space the big ones should take up
        minBigPercentage: 0, // If this is set then it will scale down the big space if there is left over whitespace down to this minimum size
        bigFixedRatio: false, // fixedRatio for the big ones
        bigScaleLastRow: true, // scale last row for the big elements
        bigAlignItems: "center", // How to align the big items
        smallAlignItems: "center", // How to align the small row or column of items if there is a big one
        maxWidth: Infinity, // The maximum width of the elements
        maxHeight: Infinity, // The maximum height of the elements
        smallMaxWidth: Infinity, // The maximum width of the small elements
        smallMaxHeight: Infinity, // The maximum height of the small elements
        bigMaxWidth: Infinity, // The maximum width of the big elements
        bigMaxHeight: Infinity, // The maximum height of the big elements
        bigMaxRatio: 3 / 2, // The narrowest ratio to use for the big elements (default 2x3)
        bigMinRatio: 9 / 16, // The widest ratio to use for the big elements (default 16x9)
        bigFirst: true, // Whether to place the big one in the top left (true) or bottom right (false).
        // You can also pass 'column' or 'row' to change whether big is first when you are in a row (bottom) or a column (right) layout
        animate: true, // Whether you want to animate the transitions using jQuery (not recommended, use CSS transitions instead)
        window: window, // Lets you pass in your own window object which should be the same window that the element is in
        ignoreClass: "OT_ignore", // Elements with this class will be ignored and not positioned. This lets you do things like picture-in-picture
        onLayout: null,
      } as any
    );

    layoutRef.current.layout();

    var resizeTimeout: any;
    window.onresize = function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        layoutRef.current.layout();
      }, 20);
    };
  }, []);

  useEffect(() => {
    layoutRef.current.layout();
    let divToRemove = document.querySelector('div[class*="ot-layout"]')!;
    if (divToRemove) {
      document.getElementById("container")?.removeChild(divToRemove);
    }
  }, [streams]);

  const joinRoom = () => {
    socket.emit(
      "joinRoom",
      { roomName: paramId?.groupId, userName: paramId?.userId },
      (data: any) => {
        console.log(`Router Rtp Capabilities... ${data.rtpCapabilities}`);
        rtpCapabilities.current = data.rtpCapabilities;
        connectDevice();
      }
    );
  };

  const getLocalStream = async () => {
    let stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    ref.current!.srcObject = stream; //src object is available only video elemnt which gives stream
    audioParams.current = {
      track: stream.getAudioTracks()[0],
      ...audioParams.current,
    };
    videoParams.current = {
      track: stream.getVideoTracks()[0],
      ...videoParams.current,
    };
    setStreams((prevState) => {
      return [
        ...prevState,
        {
          stream,
          userName: paramId?.userId,
          remote: false,
          width: "100vw",
          height: "100vh",
          big: false,
          fixedRatio: false,
          kind: "video",
          isAudio: true,
          isVideo: true,
        },
      ];
    });
    joinRoom();
    socket2.emit("join", {
      user_id: paramId.userId,
      group_id: paramId.groupId,
    });
    console.log(paramId.userId, paramId.groupId, "jkbk");

    startCapturingFrame();
  };

  const connectDevice = async () => {
    try {
      deviceRef.current = new mediaSoupClient.Device(); //returns device
      await deviceRef.current!.load({
        routerRtpCapabilities: rtpCapabilities.current!,
      });
      console.log(rtpCapabilities, "rtpCurrent");
      createSendTransport();
    } catch (err) {
      console.log(err);
    }
  };

  const signalNewConsumerTransport = async (remoteProducerId: any) => {
    if (consumingTransport.includes(remoteProducerId)) {
      return;
    }
    setConsumingTransport([...consumingTransport, remoteProducerId]);
    await socket.emit(
      "createWebrtcTransport",
      { consumer: true },
      ({ params }: any) => {
        if (params.error) {
          console.log(params);
          return;
        }
        let consumerTransport;
        try {
          consumerTransport = deviceRef.current?.createRecvTransport(params);
        } catch (err) {
          console.log(err);
          return;
        }
        consumerTransport!.on(
          "connect",
          async ({ dtlsParameters }, callback, errorBack) => {
            socket.emit("transport-recv-connect", {
              dtlsParameters,
              serverConsumerTransportId: params.id,
            });
            callback();
          }
        );
        connectReceiveTransport(consumerTransport, remoteProducerId, params.id);
      }
    );
  };

  const getProducers = () => {
    socket.emit("getProducers", (producersId: any) => {
      producersId.forEach((producerData: any) => {
        signalNewConsumerTransport(producerData);
      });
    });
  };
  const createSendTransport = () => {
    try {
      socket.emit("createWebrtcTransport", { consumer: false }, (data: any) => {
        if (data?.err) {
          console.log(data?.err);
          return;
        }
        producerTransport!.current = deviceRef.current!.createSendTransport(
          data.params
        );
        producerTransport!.current.on(
          "connect",
          async ({ dtlsParameters }: any, callback: any, ErrorBack: any) => {
            try {
              socket.emit("transport-connect", { dtlsParameters });
              callback();
            } catch (err) {
              console.log(err);
            }
          }
        );
        producerTransport.current.on(
          "produce",
          async (parameters: any, callback: any, ErrorBack: any) => {
            try {
              socket.emit(
                "transport-produce",
                {
                  kind: parameters.kind,
                  rtpParameters: parameters.rtpParameters,
                  appData: parameters.appData,
                },
                ({ id, producersExist }: any) => {
                  callback({ id });
                  if (producersExist) {
                    getProducers();
                  }
                }
              );
            } catch (err) {
              console.log(err);
            }
          }
        );
        connectSendTransport();
      });
    } catch (err) {
      console.log(err);
    }
  };
  const connectSendTransport = async () => {
    console.log(videoParams, audioParams, "a");
    try {
      audioProducer.current = await producerTransport.current.produce(
        audioParams.current
      );
      videoProducer.current = await producerTransport.current.produce(
        videoParams.current
      );

      // producerRef.current.on("trackended", () => {
      //   console.log("Track ended");
      // });
      // producerRef.current.on("transportclosed", () => {
      //   console.log("transport ended");
      // });
    } catch (err) {
      console.log(err);
    }
  };

  const connectReceiveTransport = async (
    consumerTransport: any,
    remoteProducerId: any,
    serverConsumerTransportId: any
  ) => {
    try {
      socket.emit(
        "consumer",
        {
          rtpCapabilities: deviceRef.current!.rtpCapabilities,
          remoteProducerId,
          serverConsumerTransportId,
        },
        async (data: any) => {
          if (data.err) {
            console.log(data.err, "consumer error");
            return;
          }
          consumerRef.current = await consumerTransport.consume({
            id: data.params.id,
            kind: data.params.kind,
            producerId: data.params.producerId,
            rtpParameters: data.params.rtpParameters,
          });
          setConsumerTransports([
            ...consumerTransports,
            {
              consumerTransports,
              serverConsumerTransportId: data.params.id,
              producerId: remoteProducerId,
              consumer: consumerRef.current,
            },
          ]);
          const { track } = consumerRef.current;

          const isAlreadyAdded = remoteProducersRef.current.find(
            (s) => s === remoteProducerId
          );
          console.log(remoteProducersRef);
          if (!isAlreadyAdded) {
            remoteProducersRef.current.push(remoteProducerId);
            console.log(track, "track");
            if (track.kind === "video") {
              setStreams((prevState: any) => {
                return [
                  ...prevState,
                  {
                    userName: data.userName,
                    stream: new MediaStream([track]),
                    producerId: remoteProducerId,
                    remote: true,
                    width: "100vw",
                    height: "100vh",
                    big: false,
                    fixedRatio: false,
                    kind: "video",
                    isAudio: data.isAudio,
                    isVideo: data.isVideo,
                  },
                ];
              });
            } else {
              setStreams((prevState: any) => {
                return [
                  ...prevState,
                  {
                    userName: data.userName,
                    stream: new MediaStream([track]),
                    producerId: remoteProducerId,
                    remote: true,
                    width: "100vw",
                    height: "100vh",
                    big: false,
                    fixedRatio: false,
                    kind: "audio",
                  },
                ];
              });
            }
          }

          layoutRef.current.layout();

          socket.emit("consumer-resumed", {
            serverConsumerId: data.params.serverConsumerId,
          });
        }
      );
    } catch (err) {
      console.log(err);
    }
  };
  const captureFrame = async () => {
    try {
      let context = canvasRef.current!.getContext("2d");
      context!.drawImage(
        ref.current!,
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );
      // const frameData = context?.getImageData(
      //   0,
      //   0,
      //   canvasRef.current!.width,
      //   canvasRef.current!.height
      // );
      const base64String = canvasRef.current!.toDataURL("image/jpeg", 1.0);
      setCountFrames((prevState) => {
        return prevState + 1;
      });
      // console.log(base64String);
      console.log(`Frontend Count: ${count}`);
      socket2.emit("capture_frames", {
        binaryData: base64String,
        reps: exerciseRef.current,
        exercise: exerciseNameRef.current,
        group_id: paramId?.groupId,
      });

      // requestAnimationFrame(captureFrame);
    } catch (err) {
      console.log(err);
    }
  };

  const startCapturingFrame = () => {
    intervalId.current = setInterval(() => {
      captureFrame();
    }, 1);
  };

  const toggleVideo = async () => {
    // find localstream from streams state
    const myStream = streams.find((stream) => !stream.remote);

    // check if video is already paused
    if (videoProducer.current.paused) {
      // if video is already paused then get a new local webcam stream and update the state
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: myStream.isAudio,
      });
      ref.current!.srcObject = newStream;
      disabledVideo.current = true;
      startCapturingFrame();
      // updating state with new stream
      const newStreamState = streams.map((stream) => {
        if (!stream.remote) {
          return {
            ...stream,
            isVideo: true,
            stream: newStream,
          };
        }
        return stream;
      });
      setStreams(newStreamState);

      // tell mediasoup videoProducer that replace previous  paused video stream with new one
      videoProducer.current.replaceTrack({
        track: newStream.getVideoTracks()[0],
      });
      // resume stream
      videoProducer.current.resume();

      // inform the others connected users that video is resumed
      socket.emit("video-resumed");
    } else {
      myStream.stream.getTracks().forEach((track: any) => {
        if (track.kind === "video") {
          track.enabled = false;
          track.stop();
        }
      });
      clearInterval(intervalId.current);
      const newStreamState = streams.map((stream) => {
        if (!stream.remote) {
          return {
            ...stream,
            isVideo: false,
            stream: myStream.stream,
          };
        }
        return stream;
      });
      setStreams(newStreamState);
      videoProducer.current?.pause();
      disabledVideo.current = false;

      videoParams.current.track = myStream.stream.getVideoTracks()[0];
      // inform the others connected users that user has paused their video
      socket.emit("video-paused");
    }
  };
  const toggleAudio = () => {
    if (audioProducer.current.paused) {
      const newStreamState = streams.map((stream) => {
        if (!stream.remote) {
          return {
            ...stream,
            isAudio: true,
          };
        }
        return stream;
      });
      setStreams(newStreamState);
      audioProducer.current.resume();
      socket.emit("audio-resumed");
    } else {
      const newStreamState = streams.map((stream) => {
        if (!stream.remote) {
          return {
            ...stream,
            isAudio: false,
          };
        }
        return stream;
      });
      setStreams(newStreamState);
      audioProducer.current?.pause();
      socket.emit("audio-paused");
    }
  };

  return (
    <>
      <div style={{ backgroundColor: "#171717" }}>
        {/* {only for capturing frame not displaying on ui} */}
        {/* //for frames */}
        <canvas ref={canvasRef} hidden />
        <video
          autoPlay
          playsInline
          muted
          ref={ref}
          style={{
            height: "100vh",
            width: "100vw",
            position: "relative",
            objectFit: "cover",
            visibility: "hidden",
          }}
        />
      </div>

      {/* video controls like pasue audio/video */}
      <div
        style={{
          position: "absolute",
          zIndex: 9999,
          bottom: "80px",
          width: "100vw",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            backgroundColor: "#2176ff",
            display: "flex",
            gap: "10px",
            borderRadius: "5px",
          }}
        >
          <div onClick={toggleVideo}>
            {streams.find((stream) => !stream.remote)?.isVideo ? (
              <CiVideoOn
                style={{ padding: "8px 10px", cursor: "pointer" }}
                size={30}
                color="#FFFFFF"
              />
            ) : (
              <CiVideoOff
                style={{
                  cursor: "pointer",
                  backgroundColor: "#ff2954",
                  padding: "8px 10px",
                  borderRadius: "5px",
                  marginTop: "3px",
                  marginRight: "3px",
                  marginLeft: "3px",
                }}
                size={30}
                color="#FFFFFF"
              />
            )}
          </div>
          <div onClick={toggleAudio}>
            {streams.find((stream) => !stream.remote)?.isAudio ? (
              <CiMicrophoneOn
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
                size={30}
                color="#FFFFFF"
              />
            ) : (
              <CiMicrophoneOff
                style={{
                  cursor: "pointer",
                  backgroundColor: "#ff2954",
                  padding: "8px 10px",
                  borderRadius: "5px",
                  marginTop: "3px",
                  marginRight: "3px",
                }}
                size={30}
                color="#FFFFFF"
              />
            )}
          </div>
        </div>
      </div>

      {/* {actual opentok-layout} */}
      <div
        id="container"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {streams.map((stream, index) => {
          return (
            <header
              onDoubleClick={() => {
                let el = document.querySelectorAll(
                  `header[class*='ot-layout']`
                );
                if (el[index]?.classList.contains("OT_big")) {
                  el[index].classList.remove("OT_big");
                  layoutRef.current.layout();
                } else {
                  el[index]?.classList.add("OT_big");
                  layoutRef.current.layout();
                }
              }}
              key={index}
              style={{
                height: "100vh",
                width: "100vw",
                position: "absolute",
                display: stream.kind === "video" ? "block" : "none", // if stream is for audio then don't show that on screen
              }}
              className="ot-layout"
            >
              <p
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: 20,
                  color: "white",
                  zIndex: 99,
                }}
              >
                {!stream.remote ? "You" : stream.userName}
              </p>

              {!stream.remote && (
                <h3
                  style={{
                    position: "absolute",
                    right: "20px",
                    top: "20px",
                    zIndex: 9999,
                    color: !stream.remote && stream.isVideo ? "black" : "white",
                  }}
                >
                  <p>Reps:{count}</p>
                  <p>Exercise:{exerciseName}</p>
                </h3>
              )}
              <Video
                stream={stream.stream}
                userName={stream.userName}
                height={"100%"}
                width={"100%"}
                top={"0"}
                left={"0"}
                remote={stream.remote}
                kind={stream.kind}
                isAudio={stream.isAudio}
                isVideo={stream.isVideo}
              />
            </header>
          );
        })}
      </div>
    </>
  );
};

export default Room;
