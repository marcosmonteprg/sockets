// Inicializo servidor y agregao sockets.
const dotenv = require("dotenv").config({ path: "variables.env" });
const express = require('express');
const app = express();

// Configuración básica de CORS que acepta todo
// Se instalo npm install cors
// Ahora puedo aceeder a los endopoint desde vuejs
const cors = require('cors');
app.use(cors());

const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 7000;
server.listen(port, () => {
  console.log('listening on: ' + port);
});

//para usar la capeta public y trabajar con imagenes
const fs = require('fs');
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

//Para trabjar con json y funcione el post del html
const bodyParser = require('body-parser');
app.use(bodyParser.json());

//Variables para guardar info de usuarios
const users = new Map();// Ej { 'San Martin' => { socket_id: 'Kn-y4_lstaBuDlQhAAAB', name: 'San Martin', group: 'Proceres'}} 
const ids = new Map();  // Ej { 'Kn-y4_lstaBuDlQhAAAB' => { name: 'San Martin', group: 'Proceres' }}

//Sockets - Capturo conexion y desconexion (Test con f5)
io.on('connection', (socket) => {
  console.log('a user connected ' + socket.id);
  //Broadcast envia mensaje a todos menos a mi
  socket.broadcast.emit('POPUP_NOTIFICATION', {
    message: "Nuevo Usuario Conectado",
    color: "green"
  })

  socket.on('disconnect', function () {
    const user_data = ids.get(socket.id);
    console.log('USER DISCONNECTED ' + (user_data ? user_data.name : ""))
    cleanUser(socket)
    showInfoUser()
  })

  // Registra Nombre y grupo desde VUE
  socket.on('UPDATE_USER', function (data) {

    // Si no estoy modificando solo el grupo y 
    // ya este el usuario    
    const userData = ids.get(socket.id);
    if (!(userData && userData.name == data.name) && (users.has(data.name))) {
      console.log(`La clave '${data.name}' existe en el mapa.`);
      socket.emit("USER_EXISTS");
      return
    }

    cleanUser(socket)

    users.set(data.name, { socket_id: socket.id, ...data }); // Agrego a users
    ids.set(socket.id, data); // Agrego a ids   
    socket.join(data.group); //Agrego a grupo

    showInfoUser()

    socket.emit('REGISTER_OK', {
      name: data.name,
      group: data.group
    })
  });


  // Enviar mensaje CHAT
  socket.on('SEND_MESSAGE', function (data) {
    // Si tengo nombre mando a un usuario , sino a grupo(room)
    let recipient = '';
    if (data.name) {
      const user = users.get(data.name);
      if (!user) { return } //Si no esta registrado no mando nada agregado por mi
      recipient = user.socket_id;
    } else {
      recipient = data.group;
    }
    console.log(`POPUP_NOTIFICATION triggered for` + recipient)
    io.to(recipient).emit('POPUP_NOTIFICATION', data);
  });


  // Respuesta QUIZ
  socket.on('QUIZ_RESPONSE', function (data, fn) {
    const user_data = ids.get(socket.id);
    if (user_data) {
      console.log(user_data.name + ` has pressed ` + data.response);
    }
    if (fn) {
      const yes_no = Math.floor(Math.random() * Math.floor(2));
      const result = (yes_no > 0) ? 'Correcta' : 'Incorrecta';
      console.log(`Calling callback function with ` + data.response + `  was ` + result);
      fn(`Tu respuesta es ` + data.response + ` que es ` + result)
    }
  })
});


// Emito Pulsaciones cada segundo
setInterval(() => io.emit('PULSE', heartbeat()), 1000);
function heartbeat() {
  const pulse = Math.ceil(Math.random() * (160 - 60) + 60);
  return pulse;
}


// Boton Envio notificaciones a todos los conectados(io).
//En resumen:
//- socket.emit: Comunicación individual (cliente específico).
//- io.emit: Comunicación global (todos los clientes).

app.post('/notification',
  function (req, res) {
    console.log('Message Recieved:' + req.body.message);
    io.emit('POPUP_NOTIFICATION', {
      message: req.body.message,
      color: req.body.color
    })
    res.send();
  }
)


// Boton Envio Imagen (QUIZ)
app.get('/send_image', function (req, res) {
  console.log(`Send Image Called`);
  const image_file_path = __dirname + get_random_image();
  console.log(`Sending Image ` + image_file_path);
  fs.readFile(image_file_path, function (err, buf) {
    io.emit('SHOW_IMAGE', { image: true, buffer: buf.toString('base64') })
  })
  res.send();
})

function get_random_image() {
  const index = Math.ceil(Math.random() * (6 - 1) + 1);
  return path.normalize(`/images/image${index}.jpg`)
}


function cleanUser(socket) {
  const userData = ids.get(socket.id);
  if (!userData) return;

  //Saco de users
  users.delete(userData.name);

  //Saco de ids
  [...ids.entries()]
    .filter(([_, value]) => value.name === userData.name)
    .forEach(([key]) => ids.delete(key));

  // Saco el de todos los rooms (Grupos) (copilot)
  socket.rooms.forEach((room) => {
    if (room !== socket.id) {
      socket.leave(room);
    }
  });
}


function showInfoUser() {
  console.log(users)
  console.log(ids)

  const names = [];
  for (const [key, value] of users) {
    names.push(value.name);
  }
  io.emit('LIST_USERS', names)
}