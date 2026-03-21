import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Connections from "./pages/Connections";
import Automation from "./pages/Automation";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Contacts from "./pages/Contacts";
import Management from "./pages/Management";
import Broadcast from "./pages/Broadcast";
import QuickReplies from "./pages/QuickReplies";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          {/* Rota Raiz: Login do ConversaUp (Sauberlich Technology) */}
          <Route path="/" element={<Login />} />
          
          {/* Rotas Principais */}
          <Route path="/dashboard" element={<Index />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/management" element={<Management />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/quick-replies" element={<QuickReplies />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/reports" element={<Reports />} />
          
          {/* Configurações de Equipe e Contatos */}
          <Route path="/users" element={<Users />} />
          <Route path="/contacts" element={<Contacts />} />
          
          {/* Redirecionamento e 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;