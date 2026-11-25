import React from 'react';
import {
  Send, MessageSquare, Zap, Globe, Youtube, Sparkles, Shield, Eye, BookOpen,
  Compass, Share2, Flame, Star, Crown, Mail, Link as LinkIcon, FileText, Layout,
  ExternalLink, Layers, Award, Heart, Tv, Radio, Video, PhoneCall, Bell, Info,
  Search, Terminal, Database, HelpCircle, User, Users, ShoppingBag, Bot, Cpu, Code
} from 'lucide-react';

export const ICON_LIBRARY: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Send,
  MessageSquare,
  Zap,
  Globe,
  Youtube,
  Sparkles,
  Shield,
  Eye,
  BookOpen,
  Compass,
  Share2,
  Flame,
  Star,
  Crown,
  Mail,
  Link: LinkIcon,
  FileText,
  Layout,
  ExternalLink,
  Layers,
  Award,
  Heart,
  Tv,
  Radio,
  Video,
  PhoneCall,
  Bell,
  Info,
  Search,
  Terminal,
  Database,
  HelpCircle,
  User,
  Users,
  ShoppingBag,
  Bot,
  Cpu,
  Code
};

export interface DynamicIconProps {
  name: string;
  size?: number;
  className?: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 20, className }) => {
  const IconComponent = ICON_LIBRARY[name] || Globe;
  return <IconComponent size={size} className={className} />;
};
