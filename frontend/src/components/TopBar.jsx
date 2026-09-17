import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export default function TopBar(){
 const {user}=useAuth();
 const {pathname}=useLocation();
 const section=pathname.startsWith('/fleet/')?'Detalhes do veículo':({'/':'Visão geral','/fleet':'Veículos','/drivers':'Motoristas','/fueling':'Abastecimentos','/reports':'Relatórios'}[pathname]||'Operação');
 return <header className="app-topbar"><div className="topbar-breadcrumb"><span>Operação</span><span>/</span><strong>{section}</strong></div><time className="topbar-date" dateTime={new Date().toISOString().slice(0,10)}>{new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</time><div className="user-identity"><span className="user-avatar">{(user?.name||'G').charAt(0).toUpperCase()}</span><div><strong>{user?.name||'Gestor'}</strong><small>Gestão de frota</small></div></div></header>;
}
