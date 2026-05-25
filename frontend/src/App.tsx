import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Shell } from "@/components/Shell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Kanban from "@/pages/Kanban";
import Agenda from "@/pages/Agenda";
import Ideas from "@/pages/Ideas";
import Routines from "@/pages/Routines";
import Memory from "@/pages/Memory";
import Finances from "@/pages/Finances";
import Habits from "@/pages/Habits";
import Diary from "@/pages/Diary";
import Chat from "@/pages/Chat";
import AgentPair from "@/pages/AgentPair";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/ideias" element={<Ideas />} />
        <Route path="/rotinas" element={<Routines />} />
        <Route path="/memoria" element={<Memory />} />
        <Route path="/financas" element={<Finances />} />
        <Route path="/habitos" element={<Habits />} />
        <Route path="/diario" element={<Diary />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/agente" element={<AgentPair />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
