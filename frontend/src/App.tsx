import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanRoute } from "@/components/PlanRoute";
import { Shell } from "@/components/Shell";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Upgrade from "@/pages/Upgrade";
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
import Conta from "@/pages/Conta";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/upgrade" element={<Upgrade />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="kanban" element={<Kanban />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="ideias" element={<Ideas />} />
        <Route path="rotinas" element={<Routines />} />
        <Route path="memoria" element={<Memory />} />
        <Route path="financas" element={<Finances />} />
        <Route path="habitos" element={<Habits />} />
        <Route path="diario" element={<Diary />} />
        <Route path="conta" element={<Conta />} />
        <Route
          path="chat"
          element={
            <PlanRoute requiredPlan="chat">
              <Chat />
            </PlanRoute>
          }
        />
        <Route
          path="agente"
          element={
            <PlanRoute requiredPlan="voice">
              <AgentPair />
            </PlanRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
