import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Car, TrendingUp, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) { toast.error("Falha ao entrar com Google"); setLoading(false); return; }
    if (!result.redirected) navigate({ to: "/dashboard", replace: true });
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { nome } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Entrando...");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado esquerdo — pitch */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-white/15 grid place-content-center">
            <Car className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">LavaFlow</span>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            O sistema que aumenta o faturamento do seu lava-rápido.
          </h1>
          <p className="text-primary-foreground/85 text-lg">
            Recupere clientes, fidelize com pontos, crie receita recorrente e tome decisões com dados.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3"><TrendingUp className="h-5 w-5 shrink-0" /> Receita recorrente com assinaturas mensais</li>
            <li className="flex gap-3"><Sparkles className="h-5 w-5 shrink-0" /> Oportunidades automáticas para vender mais</li>
            <li className="flex gap-3"><Users className="h-5 w-5 shrink-0" /> Recuperação de clientes inativos por WhatsApp</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/70">© LavaFlow · feito para crescer com você</p>
      </div>

      {/* Lado direito — form */}
      <div className="flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg bg-primary grid place-content-center">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Lava<span className="text-primary">Flow</span></span>
        </div>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <h2 className="font-display text-2xl font-bold mb-1">Entrar</h2>
            <p className="text-sm text-muted-foreground mb-6">Acesse seu painel de crescimento.</p>

            <Button onClick={signInGoogle} disabled={loading} variant="outline" className="w-full mb-4">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Entrar com Google
            </Button>

            <div className="relative my-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou com email</span></div></div>

            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signInEmail} className="space-y-3">
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full">Entrar</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUpEmail} className="space-y-3">
                  <div><Label>Nome</Label><Input required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                  <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Senha</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full">Criar conta grátis</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <Link to="/lp" className="text-xs text-muted-foreground mt-6 hover:underline">← Voltar</Link>
      </div>
    </div>
  );
}
