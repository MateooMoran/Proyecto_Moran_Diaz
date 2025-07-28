// IA.jsx actualizado con el mismo diseño que ya tienes en tu código y con todo funcionando correctamente.

import { useState, useRef, useEffect } from "react";
import { FiPlus, FiTrash2, FiSend } from "react-icons/fi";
import { BsChatDots } from "react-icons/bs";
import { FaBook, FaUserCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Perfil from "./Perfil";
import TextareaAutosize from 'react-textarea-autosize';
import Logo from '../../public/images/logo.png';
import axios from "axios";

const IA = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [input, setInput] = useState("");
  const [perfilVisible, setPerfilVisible] = useState(false);
  const [pendienteCorreccion, setPendienteCorreccion] = useState(null);
  const messagesEndRef = useRef(null);

 useEffect(() => {
  let mounted = true;
  const savedChatId = localStorage.getItem("selectedChatId");

  const fetchConversaciones = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/conversaciones`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversaciones = Array.isArray(res.data)
        ? res.data.map((conv) => ({
            id: conv._id,
            title: conv.titulo,
            messages: conv.mensajes?.filter(m => m.contenido !== "__placeholder__") || [],
          }))
        : [];

      if (!mounted) return;

      // Si no hay ninguna conversación
      if (conversaciones.length === 0) {
        const nueva = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/conversaciones/nuevo`,
          { primerMensaje: "__placeholder__" },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { _id, titulo, mensajes } = nueva.data.conversacion;
        const nuevaConversacion = {
          id: _id,
          title: titulo,
          messages: [],
        };

        if (!mounted) return;
        setChats([nuevaConversacion]);
        setSelectedChatId(_id);
        localStorage.setItem("selectedChatId", _id);
        return;
      }

      // Si hay conversaciones previas
      setChats(conversaciones);
      const chatValido = conversaciones.find(c => c.id === savedChatId);
      const idAUsar = chatValido ? chatValido.id : conversaciones[0].id;
      setSelectedChatId(idAUsar);
      localStorage.setItem("selectedChatId", idAUsar);

    } catch (error) {
      console.error("Error al cargar conversaciones:", error);
    }
  };

  fetchConversaciones();

  return () => {
    mounted = false;
  };
}, [token]);




  useEffect(() => {
    const fetchConversaciones = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/conversaciones`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const conversaciones = Array.isArray(res.data)
          ? res.data.map((conv) => ({
              id: conv._id,
              title: conv.titulo,
              messages: conv.mensajes || [],
            }))
          : [];

        setChats(conversaciones);
      } catch (error) {
        console.error("Error al cargar conversaciones:", error);
      }
    };
    fetchConversaciones();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const handleNewChat = async () => {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/conversaciones/nuevo`,
      { primerMensaje: "__placeholder__" },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { _id, titulo, mensajes } = res.data.conversacion;
    const newChat = { id: _id, title: titulo, messages: [] };

    setChats(prev => [newChat, ...prev]);
    setSelectedChatId(_id);
    localStorage.setItem("selectedChatId", _id);
    setInput("");

  } catch (error) {
    console.error("Error creando nueva conversación:", error);
  }
};



  const handleSelectChat = (id) => {
  setSelectedChatId(id);
  localStorage.setItem("selectedChatId", id);
};

  const handleDeleteChat = async (id) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/conversaciones/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChats(chats.filter((chat) => chat.id !== id));
      if (selectedChatId === id) {
        setSelectedChatId(null);
        setInput("");
      }
    } catch (error) {
      console.error("Error al eliminar conversación:", error);
    }
  };

  const handleBuscar = async () => {
  if (!input.trim()) return;
  const textoUsuario = input.trim();
  let chatIdToUse = selectedChatId;
  let newChats = [...chats];

  try {
    // Crear conversación si no hay
    if (!chatIdToUse) {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/conversaciones/nuevo`,
        { primerMensaje: textoUsuario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { _id, titulo, mensajes } = res.data.conversacion;
      chatIdToUse = _id;
      const newChat = { id: _id, title: titulo, messages: mensajes || [] };
      newChats.unshift(newChat);
      setChats(newChats);
      setSelectedChatId(_id);
      localStorage.setItem("selectedChatId", _id);
    } else {
      // Agregar mensaje del usuario
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/conversaciones/${chatIdToUse}/mensajes`,
        { rol: "Estudiante", contenido: textoUsuario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const chatActual = chats.find(chat => chat.id === chatIdToUse);
      if (chatActual?.title === "__placeholder__") {
        try {
          await axios.patch(
            `${import.meta.env.VITE_BACKEND_URL}/conversaciones/${chatIdToUse}`,
            { nuevoTitulo: textoUsuario.slice(0, 30) },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          console.error("Error actualizando título:", error);
        }
      }
    }

    // Buscar respuesta
    const res = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/buscar`,
      { query: textoUsuario }
    );

    const respuesta = res.data.respuesta;

    // Guardar respuesta de IA si no necesita aprendizaje
    if (!res.data.necesita_aprendizaje) {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/conversaciones/${chatIdToUse}/mensajes`,
        { rol: "IA", contenido: respuesta },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else {
      setPendienteCorreccion({
        pregunta: res.data.pregunta_original,
        chatId: chatIdToUse
      });
    }

    // 🔄 Refrescar los chats desde backend
    const convRes = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/conversaciones`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const actualizados = convRes.data.map(c => ({
      id: c._id,
      title: c.titulo,
      messages: c.mensajes || []
    }));
    setChats(actualizados);
    setInput("");
  } catch (error) {
    console.error("Error en el flujo:", error);
  }
};


  const enviarCorreccion = async (respuestaCorrecta) => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/corregir`, {
        pregunta: pendienteCorreccion.pregunta,
        respuesta_correcta: respuestaCorrecta,
        metadata: { fuente: "usuario" },
      });

      setChats(prev =>
        prev.map(chat =>
          chat.id === pendienteCorreccion.chatId
            ? { ...chat, messages: [...chat.messages, { id: Date.now(), text: respuestaCorrecta, author: "ia" }] }
            : chat
        )
      );

      setPendienteCorreccion(null);
    } catch (error) {
      console.error("Error enviando corrección:", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBuscar();
    }
  };

  const currentChat = chats.find((chat) => chat.id === selectedChatId);

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-50 text-gray-900">
      <header className="bg-gray-950 text-white p-3 px-6 flex justify-between items-center shadow-md border-b-2 border-sky-700">
        <img src={Logo} style={{ width: "50px", height: "50px" }} />
        <h1 className="text-lg font-bold">Jezt IA</h1>
        <div className="cursor-pointer hover:text-blue-300" onClick={() => setPerfilVisible(true)}>
          <FaUserCircle className="text-2xl" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-gray-950 border-r-2 border-sky-700 shadow-md p-4 flex flex-col">
          <button onClick={handleNewChat} className="flex items-center gap-2 p-2 mb-4 text-sm font-semibold text-gray-100 bg-gradient-to-r from-blue-900 via-sky-800 to-sky-700 rounded hover:scale-105 transition-transform">
            <FiPlus /> Nueva conversación
          </button>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-600 scrollbar-track-gray-100">
            {chats
  .filter(chat => chat.title !== "__placeholder__")
  .map((chat) => (
    <div
      key={chat.id}
      className={`flex items-center justify-between gap-2 p-2 mb-2 text-sm rounded cursor-pointer transition-colors ${selectedChatId === chat.id ? "bg-sky-600 text-white" : "hover:bg-sky-600 text-gray-400"}`}
      onClick={() => handleSelectChat(chat.id)}
    >
      <div className="flex items-center gap-2 truncate">
        <BsChatDots />
        <span className="truncate">{chat.title}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteChat(chat.id);
        }}
        className="hover:text-red-500"
      >
        <FiTrash2 />
      </button>
    </div>
))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-gray-950 text-white overflow-hidden">
          <section className="flex-1 p-6 overflow-y-auto flex flex-col" style={{ scrollBehavior: 'smooth' }}>
  <div className="flex flex-col items-center">
    <img src={Logo} alt="Logo" style={{ width: "125px", height: "125px" }} />
    <h3 className="mt-4">Hola, Yo soy Jezt IA.</h3>
  </div>

  {currentChat && currentChat.messages
  .filter(m => m.contenido !== "__placeholder__" && m.text !== "__placeholder__")
  .map((msg, index) => {
    const texto = msg.text || msg.contenido || "";
    const esUsuario = msg.author === "user" || msg.rol === "Estudiante";
    return (
      <div
        key={msg.id || `${msg.rol || msg.author}-${index}`}
        className={`max-w-[70%] w-fit mb-3 px-5 py-3 rounded-lg shadow-sm whitespace-pre-wrap break-words ${
          esUsuario ? "bg-sky-700 text-gray-200 self-end" : "bg-blue-950 text-gray-200 self-start"
        }`}
      >
        {texto}
      </div>
    );
  })}

  {pendienteCorreccion && (
    <div className="p-4 bg-sky-700 text-black rounded my-4">
      <p><strong>Jezt IA:</strong> ¿Qué debería responder a: "{pendienteCorreccion.pregunta}"?</p>
      <input
        type="text"
        placeholder="Escribe una respuesta..."
        className="w-full mt-2 p-2 border rounded"
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.value.trim().length > 0) {
            enviarCorreccion(e.target.value.trim());
            e.target.value = "";
          }
        }}
      />
    </div>
  )}

  <div ref={messagesEndRef} />
</section>


          <footer className="bg-gray-950 p-4 border-t border-sky-700 flex items-center gap-2">
            <TextareaAutosize
              minRows={1}
              maxRows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Haz tu pregunta"
              className="bg-gray-950 flex-1 border-sky-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-600 transition-all text-gray-300"
            />
            <button onClick={handleBuscar} className="p-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-white transition-colors">
              <FiSend />
            </button>
          </footer>
        </main>
      </div>

      <Perfil
        visible={perfilVisible}
        onClose={() => setPerfilVisible(false)}
        nombre={"Gabriel Imbaquingo"}
        imagenUrl={"https://i.pravatar.cc/150?u=gabriel.imbaquingo@example.com"}
      />
    </div>
  );
};

export default IA;