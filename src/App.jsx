import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Routes, Route, useNavigate } from "react-router-dom";
import { FaDownload, FaPaperPlane, FaPlus, FaSignOutAlt, FaUpload, FaUser } from "react-icons/fa";
import logo from "./assets/logo.png";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark as atomOneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FaTrashCan } from "react-icons/fa6";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function Home() {
  const nav = useNavigate();
  return (
    <main className="main-content">
      <img src={logo} alt="Demiochat+" />
      <div className="items">
        <h1>Demiochat+</h1>
        <span>A <i>new way to experience</i> Demiochat.</span>
        <div className="buttons">
          <button onClick={() => nav("/login")}><FaUser /> Login</button>
          <button onClick={() => nav("/register")}><FaPlus /> Register</button>
        </div>
      </div>
    </main>
  );
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Both email and password must be filled in!");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError(error.message);
      return;
    }

    if (data?.user) {
      nav("/chat");
    }
  };

  return (
    <form className="user-form" onSubmit={handleLogin}>
      <h1>Login</h1>
      <span className="message">{error}</span>
      <label htmlFor="email">Email *</label><br />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /><br />
      <label htmlFor="passwd">Password *</label><br />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /><br />
      <button type="submit">Log in</button>
    </form>
  );
}

function Register() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          isDeleted: false
        }
      }
    });

    if (error) {
      setError(error.message);
      return;
    }

    nav("/chat")
  };

  return (
    <form className="user-form" onSubmit={handleRegister}>
      <h1>Register</h1>
      <span className="message">{error}</span><br />
      <label>Username *</label><br />
      <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" required /><br />
      <label>Email *</label><br />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /><br />
      <label>Password *</label><br />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /><br />
      <button type="submit">Register</button>
    </form>
  );
}

function ChatMessage({ message, removeMessage }) {
  const { author_name, message: msg, id, created_at, file } = message;
  const [isAuthor, setIsAuthor] = useState(false);

  useEffect(() => {
    const checkIfAuthor = async () => {
      const { data } = await supabase.auth.getUser();
      const uname = data?.user?.user_metadata?.username;
      setIsAuthor(author_name === uname);
    };
    checkIfAuthor();
  }, [author_name]);

  const deleteMessage = async () => {
    if (confirm("Are you sure you want to delete this message?")) {
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (!error) removeMessage(id);
    }
  };

  return (
    <div className="chat-message">
      <div className="message-header">
        <span className="username">{author_name}</span>
        <span className="date">{new Date(created_at).toLocaleString()}</span>
        {isAuthor && (
          <button className="delete-msg" onClick={deleteMessage}>
            <FaTrashCan /> Remove Message
          </button>
        )}
      </div>
      <div className="message-content">
        <ReactMarkdown
          children={msg}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter style={atomOneDark} language={match[1]} PreTag="div" {...props}>
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        />
        <br />
        {file && (
          <div className="file-box">
            <span>{file.split("/").pop().split("?")[0]}</span><br />
            <button onClick={() => window.open(file)}><FaDownload /> Download</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chat() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [file, setFile] = useState(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const msgEnd = useRef(null);
  const fileInput = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const initChat = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (user?.user_metadata?.isDeleted) {
        await supabase.auth.signOut();
        nav("/?reason=account_deleted");
        return;
      }

      setUsername(user?.user_metadata?.username || "Unknown");
      setIsEmailVerified(!!user?.email_confirmed_at);

      const { data: messagesData } = await supabase.from("messages").select("*");
      setMessages(messagesData || []);
    };

    initChat();

    const channel = supabase
      .channel("messages-channel")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nav]);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();

    const { data: fresh } = await supabase.auth.getUser();

    if (!message.trim() && !file) return;

    let fileUrl = null;

    if (file) {
      const path = `files/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("demiochatplus-storage")
        .upload(path, file);

      if (uploadError) {
        alert(uploadError.message);
        return;
      }

      const { data, error: urlError } = await supabase.storage
        .from("demiochatplus-storage")
        .createSignedUrl(path, 3600);

      if (urlError) {
        alert(urlError.message);
        return;
      }

      fileUrl = data.signedUrl;
    }

    await supabase.from("messages").insert({
      id: crypto.randomUUID(),
      author_name: username,
      message,
      created_at: new Date().toISOString(),
      file: fileUrl
    });

    setMessage("");
    setFile(null);
    fileInput.current.value = "";
  };

  const removeMessage = (id) => {
    setMessages((prev) => prev.filter(msg => msg.id !== id));
  };

  const logOut = async () => {
    if (confirm("Sign out?")) {
      await supabase.auth.signOut();
      nav("/");
    }
  };

  const deleteAccount = async () => {
    if (confirm("Delete your account?")) {
      await supabase.auth.updateUser({
        data: { isDeleted: true },
        password: "",
        email: ""
      });
      await supabase.auth.signOut();
      nav("/");
    }
  };
 
  return (
    <>
      <button onClick={logOut} className="sign-out"><FaSignOutAlt /> Sign out</button>
      <button onClick={deleteAccount} className="delete-account"><FaTrashCan /> Delete account</button>

      <div className="chat-msgs">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} removeMessage={removeMessage} />
        ))}
        <div ref={msgEnd} />
      </div>

      <input onChange={(e) => setFile(e.target.files[0])} type="file" ref={fileInput} style={{ display: "none" }} />
      <form onSubmit={sendMessage} className="msg-input">
        <button type="button" onClick={() => fileInput.current.click()}><FaUpload /></button>
        <button type="button" onClick={() => { setFile(null); fileInput.current.value = ""; }}>Unlink file</button>
        {file && <span className="file-name">{file.name}</span>}
        <br />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say something!"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
          rows={2}
          
        />
        <button type="submit"><FaPaperPlane /></button>
      </form>
    </>
  );
}

function App() {
  const nav = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) nav("/chat");
    };
    checkSession();
  }, [nav]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

export default App;