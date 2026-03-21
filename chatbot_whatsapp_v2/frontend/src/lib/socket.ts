import { io } from 'socket.io-client';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

export const socket = io(API_BASE_URL, {
  autoConnect: true,
  reconnection: true,
});