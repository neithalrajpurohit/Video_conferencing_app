import { Routes, Route } from "react-router-dom";
import Room from "./Room";
import App from "../App";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/room/:userId/:groupId" element={<Room />} />
    </Routes>
  );
};
