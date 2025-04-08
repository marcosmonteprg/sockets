// Inicializo servidor y agregao sockets.
const dotenv = require("dotenv").config({ path: "variables.env"});
const express = require('express');
const app = express();

const http = require('http');
const server = http.createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 7000;

server.listen(port, () => {
  console.log('listening on: '+port);
});


//para usar la capeta public y trabajar con imagenes
const fs = require('fs'); 
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));


//Para trabjar con json y funcione el post del html
const bodyParser = require('body-parser');
app.use(bodyParser.json());


//Variables para el chat
const users = new Map();
const ids = new Map();


//Sockets - Capturo conexion y desconexion (Test con f5)
io.on('connection', (socket) => {
  console.log('a user connected ' + socket.id);
  //Broadcast envia mensaje a todos menos a mi
  socket.broadcast.emit('POPUP_NOTIFICATION', {
    message: "Nuevo Usuario Conectado",
    color: "green"
  })
  
  
  
  socket.on('disconnect', function () {
    // obtengo el nombre real del socket si fue informado
    const user_data = ids.get(socket.id);
    if(user_data){
      console.log('USER DISCONNECTED ' + user_data.name)
    }else{
      // No tengo el nombre ( no lo registre con UPDATE_USER)    
    }
  })

  // Registra Nombre y grupo desde VUE
  socket.on('UPDATE_USER', function (data) {
    console.log(`UPDATE_USER triggered for `+ data.name)
    // Map Socket ID with a User
    users.set(data.name, { socket_id: socket.id, ...data });
    ids.set(socket.id, data); 
    
    // Saco el socket de todos los rooms
    var Rooms = Object.keys(io.sockets.adapter.sids[socket.id]).filter(item => item!=socket.id);     
    
    for(var i= 0; i < Rooms.length; i++)
    { 
      if (Rooms[i] != data.group) //Solo si cambio de room
        socket.leave(Rooms[i]);       
      }    
    // Agrego el socket al room
    socket.join(data.group);
    
  });

  
  // Enviar mensaje CHAT
  socket.on('SEND_MESSAGE', function (data) {
    // Si tengo nombre mando a un usuario , sino a grupo(room)
    let recipient = '';
    if (data.name) {
      const user = users.get(data.name);
      recipient = user.socket_id;
    } else {
      recipient = data.group;
    }
    console.log(`POPUP_NOTIFICATION triggered for`+ recipient)
    io.to(recipient).emit('POPUP_NOTIFICATION', data);
  });

  
  // Respuesta QUIZ
  socket.on('QUIZ_RESPONSE', function (data, fn) {
    const user_data = ids.get(socket.id);
    if (user_data) {
      console.log( user_data.name+ ` has pressed `+data.response );
    }
    if (fn) {
      const yes_no = Math.floor(Math.random() * Math.floor(2));
      const result = (yes_no > 0) ? 'Correcta' : 'Incorrecta';
      console.log(`Calling callback function with `+ data.response+ `  was ` +result );
      fn(`Tu respuesta es `+data.response+` que es `+result)
    }
  })

});



// Boton Envio notificaciones (PULSACIONES)
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
app.get('/send_image', function (req,res){
  console.log(`Send Image Called`);
  const image_file_path = __dirname + get_random_image();
  console.log(`Sending Image `+image_file_path);
  fs.readFile(image_file_path, function (err, buf) {      
      io.emit('SHOW_IMAGE', { image: true, buffer: buf.toString('base64') })
  })
  res.send();
})

function get_random_image(){
  const index = Math.ceil(Math.random() * (6-1) + 1);
  return path.normalize(`/images/image${index}.jpg`)
}



// Emito Pulsaciones cada segundo
setInterval(() => io.emit('PULSE', heartbeat()), 1000);
function heartbeat() {
  const pulse = Math.ceil(Math.random() * (160 - 60) + 60);
  return pulse;
}