import React from 'react';
import {
  ShoppingCart,
  Utensils,
  Home,
  Car,
  Repeat,
  HeartPulse,
  Tv,
  Banknote,
  TrendingUp,
  Sparkles,
  Coffee,
  Smartphone,
  Wifi,
  Zap,
  Plane,
  Shield,
  Briefcase,
  Gift,
  Tag,
  CreditCard,
  Music,
  Film,
  Dumbbell,
  BookOpen,
  DollarSign,
  Euro
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  'shopping-cart': ShoppingCart,
  'shoppingcart': ShoppingCart,
  'cart': ShoppingCart,
  'utensils': Utensils,
  'food': Utensils,
  'dining': Utensils,
  'home': Home,
  'house': Home,
  'car': Car,
  'transport': Car,
  'repeat': Repeat,
  'subscription': Repeat,
  'heart-pulse': HeartPulse,
  'heartpulse': HeartPulse,
  'health': HeartPulse,
  'tv': Tv,
  'entertainment': Tv,
  'banknote': Banknote,
  'money': Banknote,
  'salary': Banknote,
  'trending-up': TrendingUp,
  'trendingup': TrendingUp,
  'invest': TrendingUp,
  'sparkles': Sparkles,
  'coffee': Coffee,
  'smartphone': Smartphone,
  'phone': Smartphone,
  'wifi': Wifi,
  'zap': Zap,
  'plane': Plane,
  'travel': Plane,
  'shield': Shield,
  'insurance': Shield,
  'briefcase': Briefcase,
  'work': Briefcase,
  'gift': Gift,
  'tag': Tag,
  'credit-card': CreditCard,
  'music': Music,
  'film': Film,
  'dumbbell': Dumbbell,
  'gym': Dumbbell,
  'book-open': BookOpen,
  'dollar-sign': DollarSign,
  'euro': Euro
};

interface CategoryIconProps {
  iconName?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName = 'tag',
  className = 'w-5 h-5',
  size = 20
}) => {
  const normalizedKey = (iconName || 'tag').toLowerCase().trim();
  const IconComponent = ICON_MAP[normalizedKey] || Tag;

  return <IconComponent className={className} size={size} />;
};

export const AVAILABLE_ICONS = [
  'shopping-cart',
  'utensils',
  'home',
  'car',
  'repeat',
  'heart-pulse',
  'tv',
  'banknote',
  'trending-up',
  'sparkles',
  'coffee',
  'smartphone',
  'wifi',
  'zap',
  'plane',
  'shield',
  'briefcase',
  'gift',
  'music',
  'dumbbell'
];
