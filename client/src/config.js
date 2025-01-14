const config = {
    SERVER_URL: process.env.NODE_ENV === 'production' 
        ? 'https://ranked-c55ffwvpw-gabrielrnkovics-projects.vercel.app'
        : 'http://localhost:5000',
    SOCKET_OPTIONS: {
        transports: ['websocket'],
        forceNew: true,
        reconnection: true,
        timeout: 10000
    }
};

export default config;
