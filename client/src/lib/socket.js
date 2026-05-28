import { io } from 'socket.io-client';
import { getToken } from './authStorage';

let socket;

export const connectSocket = () => {
  if (socket?.connected) return socket;
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token: getToken() },
    transports: ['websocket']
  });
  return socket;
};

export const getSocket = () => socket;
export const disconnectSocket = () => {
  if (socket) socket.disconnect();
  socket = null;
};
