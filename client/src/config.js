const config = {
    SERVER_URL: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000',
    SOCKET_OPTIONS: {
        transports: ['websocket', 'polling'],
        path: '/socket.io/',
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true,
        withCredentials: true,
        forceNew: true
    }
};

export default config;
