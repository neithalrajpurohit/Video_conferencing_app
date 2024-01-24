import express from "express";
import { createServer } from "http"; //express server
//to ensure duplex connection between both client and server
import { Server } from "socket.io"; //socket server

import mediasoup from "mediasoup";
import cors from "cors";

const app = express();
const options = {};
const httpServer = createServer(app);

//not using app,listen as socket accepts httpServer
//passing cors to let client socket connect with the server socket
const io = new Server(httpServer, { cors: { origin: "*" } }); //setting socket server which returns io .io on
// which events like on,emit are performed`
const port = 3443;

let worker;
let producers = [];
let consumers = [];
let transports = [];
let peers = {};
let rooms = {};
// Creation of Worker
app.use(cors());

const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMaxPort: 80100,
    rtcMinPort: 80000,
  });
  console.log(worker.pid); //pid is process id

  // when the browser is closed worker gets disconnected
  worker.on("died", (err) => {
    console.log("mediasoup worker has closed");
  });
  return worker;
};
createWorker().then((newWorker) => {
  worker = newWorker;
});

// mediacodecs -->keeps the metadata related to audio and videos
const mediacodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];

// setting up connection

const updateAndBroadcastUserCount = (roomName) => {
  const userCount = Object.keys(rooms[roomName]?.peers || {}).length;
  console.log(userCount)
  io.to(roomName).emit("user-count-updated", { userCount});
}
//io.emit sends the info to all the sockets connected

io.on("connection", async (socket) => {
  console.log(socket.id);
  socket.emit("connection-successfull", {
    socketId: socket.id,
  });
  const removeItems = (items, socketId, type) => {
    items.forEach((item) => {
      if (item.socketId === socket.id) {
        item[type].close();
      }
    });
    items = items.filter((item) => item.socketId !== socket.id);
    return items;
  };

  socket.on("disconnect", () => {
    // do some cleanup
    console.log("peer disconnected");

    // get roomName
    const roomName = peers[socket.id]?.roomName;
    const userName = peers[socket.id]?.userName;
    let socketIds = rooms[roomName]?.peers;
    console.log(rooms[roomName]?.peers, "asmaksmak");

    if (socketIds) {
      for (let socketId of rooms[roomName]?.peers) {
        io.to(socketId).emit("user-disconnected", { userName });
      }
    }

    consumers = removeItems(consumers, socket.id, "consumer");
    producers = removeItems(producers, socket.id, "producer");
    transports = removeItems(transports, socket.id, "transport");

    const data = peers[socket.id];
    delete peers[socket.id];
    if (data?.roomName) {
      // remove socket from room
      const { roomName } = data;
      rooms[roomName] = {
        router: rooms[roomName].router,
        peers: rooms[roomName].peers.filter(
          (socketId) => socketId !== socket.id
        ),
      };
    }
  });

  socket.on("joinRoom", async ({ roomName, userName }, callback) => {
    let router1 = await createRoom(roomName, socket.id);
    peers[socket.id] = {
      socket,
      roomName,
      userName,
      isAudio: true,
      isVideo: true,
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: { name: "", isAdmin: false },
    };
    const rtpCapabilities = router1.rtpCapabilities;
    callback({ rtpCapabilities });

    // Notify all clients in the room about the updated user count
    updateAndBroadcastUserCount(roomName)
  });
  const createRoom = async (roomName, socketId) => {
    let router1;
    let peers = [];
    if (rooms[roomName]) {
      router1 = rooms[roomName].router;
      peers = rooms[roomName].peers || [];
    } else {
      router1 = await worker.createRouter({ mediaCodecs: mediacodecs });
    }
    console.log("router id", router1.id, peers.length);
    rooms[roomName] = {
      router: router1,
      peers: [...peers, socketId],
    };
    return router1;
  };

  // creating a transport
  // If sender is true it is a producer,when it becomes false it becomes consumer
  socket.on("createWebrtcTransport", async ({ consumer }, callback) => {
    const roomName = peers[socket.id].roomName;
    const router = rooms[roomName].router;

    createWebrtcTransport(router).then(
      (transport) => {
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });
        addTransport(transport, roomName, consumer);
      },
      (err) => {
        console.log(err);
      }
    );
  });

  //connected through producer transport
  const addTransport = (transport, roomName, consumer) => {
    transports = [
      ...transports,
      { socketId: socket.id, transport, roomName, consumer },
    ];
    peers[socket.id] = {
      ...peers[socket.id],
      transports: [...peers[socket.id].transports, transport.id],
    };
  };
  const addProducer = (producer, roomName) => {
    producers = [...producers, { socketId: socket.id, producer, roomName }];
    peers[socket.id] = {
      ...peers[socket.id],
      producers: [...peers[socket.id].producers, producer.id],
    };
  };
  const addConsumer = (consumer, roomName) => {
    consumers = [...consumers, { socketId: socket.id, consumer, roomName }];
    peers[socket.id] = {
      ...peers[socket.id],
      consumers: [...peers[socket.id].consumers, consumer.id],
    };
  };
  socket.on("getProducers", (callback) => {
    const { roomName } = peers[socket.id];
    let producerList = [];
    producers.forEach((producerData) => {
      if (
        producerData.socketId !== socket.id &&
        producerData.roomName === roomName
      ) {
        producerList = [...producerList, producerData.producer.id];
      }
    });
    // return the producer list back to the client
    callback(producerList);
  });
  const informConsumers = (roomName, socketId, id) => {
    console.log(`just joined, id ${id} ${roomName}, ${socketId}`);
    // A new producer just joined
    // let all consumers to consume this producer
    producers.forEach((producerData) => {
      if (
        producerData.socketId !== socketId &&
        producerData.roomName === roomName
      ) {
        const producerSocket = peers[producerData.socketId].socket;
        // use socket to send producer id to producer
        producerSocket.emit("new-producer", { producerId: id });
      }
    });
  };
  const getTransport = (socketId) => {
    const [producerTransport] = transports.filter((transport) => {
      return transport.socketId === socketId && !transport.consumer;
    });
    return producerTransport.transport;
  };

  socket.on("transport-connect", async ({ dtlsParameters }) => {
    try {
      getTransport(socket.id).connect({ dtlsParameters });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on(
    "transport-produce",
    async ({ kind, rtpParameters, appData }, callback) => {
      try {
        const producer = await getTransport(socket.id).produce({
          kind,
          rtpParameters,
        });
        const { roomName } = peers[socket.id];
        addProducer(producer, roomName);
        informConsumers(roomName, socket.id, producer.id);

        console.log(producer.id, producer.kind, "producer id");
        producer.on("transportclose", () => {
          console.log("transport for this producer is closed");
          producer.close();
        });
        callback({
          id: producer.id,
          producersExist: producers.length > 1 ? true : false,
        });
      } catch (error) {
        console.log(error);
      }
    }
  );

  socket.on(
    "transport-recv-connect",
    async ({ dtlsParameters, serverConsumerTransportId }) => {
      try {
        const consumerTransport = transports.find((transportData) => {
          return (
            transportData.consumer &&
            transportData.transport.id === serverConsumerTransportId
          );
        }).transport;
        await consumerTransport.connect({
          dtlsParameters,
        });
      } catch (error) {
        console.log(error);
      }
    }
  );
  socket.on(
    "consumer",
    async (
      { serverConsumerTransportId, rtpCapabilities, remoteProducerId },
      callback
    ) => {
      try {
        const { roomName } = peers[socket.id];
        const router = rooms[roomName].router;
        let consumerTransport = transports.find((transportData) => {
          return (
            transportData.consumer &&
            transportData.transport.id === serverConsumerTransportId
          );
        }).transport;

        if (
          router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities: rtpCapabilities,
          })
        ) {
          let consumer = await consumerTransport.consume({
            producerId: remoteProducerId,
            rtpCapabilities: rtpCapabilities,
            paused: true,
          });
          consumer.on("transportclose", () => {
            console.log("transport closed from consumer");
          });
          consumer.on("producerclose", () => {
            const remoteSocket = producers.find(
              (p) => p.producer.id === remoteProducerId
            );
            const userName = peers[remoteSocket.socketId].userName;
            socket.emit("producer-closed", { remoteProducerId, userName });
            consumerTransport.close([]);
            transports = transport.filter((transportData) => {
              return transportData.transport.id !== consumerTransport.id;
            });
            consumer.close();
            console.log("producer closed from consumer");
            consumers = consumers.filter((consumerData) => {
              consumerData.consumer.id !== consumer.id;
            });
          });
          addConsumer(consumer, roomName);
          const params = {
            id: consumer.id,
            producerId: remoteProducerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            serverConsumerId: consumer.id,
          };
          const remoteSocket = producers.find(
            (p) => p.producer.id === remoteProducerId
          );

          // inform current user other users information
          const userName = peers[remoteSocket.socketId].userName;
          const isVideo = peers[remoteSocket.socketId].isVideo;
          const isAudio = peers[remoteSocket.socketId].isAudio;

          callback({ userName, params, isVideo, isAudio });
        }
      } catch (err) {
        console.log(err);
      }
    }
  );
  socket.on("consumer-resumed", async ({ serverConsumerId }) => {
    const { consumer } = consumers.find((consumerData) => {
      return consumerData.consumer.id == serverConsumerId;
    });
    await consumer.resume();
  });

  // informing other users that this user has paused their video
  socket.on("video-paused", () => {
    const roomName = peers[socket.id].roomName;
    const userName = peers[socket.id].userName;
    const socketIds = rooms[roomName].peers;

    peers[socket.id].isVideo = false;

    socketIds.forEach((peer) => {
      if (peer !== socket.id) {
        io.to(peer).emit("video-paused", { userName });
      }
    });
  });
  // informing other users that this user has resumed their video
  socket.on("video-resumed", () => {
    const roomName = peers[socket.id].roomName;
    const userName = peers[socket.id].userName;
    const socketIds = rooms[roomName].peers;

    peers[socket.id].isVideo = true;

    socketIds.forEach((peer) => {
      if (peer !== socket.id) {
        io.to(peer).emit("video-resumed", { userName });
      }
    });
  });

  // informing other users that this user has paused their audio
  socket.on("audio-paused", () => {
    const roomName = peers[socket.id].roomName;
    const userName = peers[socket.id].userName;
    const socketIds = rooms[roomName].peers;

    peers[socket.id].isAudio = false;

    socketIds.forEach((peer) => {
      if (peer !== socket.id) {
        io.to(peer).emit("audio-paused", { userName });
      }
    });
  });
  // informing other users that this user has resumed their audio
  socket.on("audio-resumed", () => {
    const roomName = peers[socket.id].roomName;
    const userName = peers[socket.id].userName;
    const socketIds = rooms[roomName].peers;

    peers[socket.id].isAudio = true;

    socketIds.forEach((peer) => {
      if (peer !== socket.id) {
        io.to(peer).emit("audio-resumed", { userName });
      }
    });
  });
});

httpServer.listen(port, () => {
  console.log(`listening to port ${port}`);
});

const createWebrtcTransport = async (router) => {
  //webrtc transport options
  return new Promise(async (resolve, reject) => {
    try {
      const webRtcTransport_options = {
        listenInfos: [
          {
            protocol: "tcp",
            ip: "192.168.29.141",
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      };

      // createWebrtcTransport ->generates an transport id
      let transport = await router.createWebRtcTransport(
        webRtcTransport_options
      );

      transport.on("dtlsstatechange", (dtlsState) => {
        if (dtlsState === "closed") {
          transport.close();
        }
      });
      transport.on("close", () => {
        console.log("transport closed");
      });
      //sending back to the client the following parameters
      // iceparams and candidates are nothung but used to establish connection between
      // 2 peers
      resolve(transport);

      return transport;
    } catch (err) {
      console.log(err);
      callback({
        params: {
          err: err,
        },
      });
    }
  });
};
