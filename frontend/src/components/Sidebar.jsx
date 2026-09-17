import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, Fuel, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
const links = [
  {to:'/',icon:LayoutDashboard,label:'Visão geral'},
  {to:'/fleet',icon:Truck,label:'Veículos'},
  {to:'/drivers',icon:Users,label:'Motoristas'},
  {to:'/fueling',icon:Fuel,label:'Abastecimentos'},
  {to:'/reports',icon:FileText,label:'Relatórios'},
];
export default function Sidebar(){
  const {logout}=useAuth();
  return <aside className="app-sidebar">
    <NavLink to="/" className="sidebar-brand" aria-label="EHR Solutions — Visão geral"><span className="brand-mark"><Truck size={22}/></span><span className="sidebar-label"><strong>EHR Solutions</strong><small>Gestão de frota</small></span></NavLink>
    <span className="sidebar-section sidebar-label">OPERAÇÃO</span>
    <nav aria-label="Navegação principal">{links.map(({to,icon:Icon,label})=><NavLink key={to} to={to} end={to==='/'} title={label} aria-label={label} className={({isActive})=>`sidebar-link ${isActive?'active':''}`}><Icon size={18}/><span className="sidebar-label">{label}</span></NavLink>)}</nav>
    <div className="sidebar-footer"><span className="sidebar-label eyebrow">PAINEL DO GESTOR</span><button className="sidebar-link" onClick={logout} title="Sair" aria-label="Sair"><LogOut size={18}/><span className="sidebar-label">Sair da conta</span></button></div>
  </aside>;
}
