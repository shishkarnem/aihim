import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface DynamicSeoOverrides {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  jsonLd?: Record<string, any> | null;
}

const CUSTOM_SEO_EVENT = 'aihim:seo_override';

export function publishSeoOverride(overrides: DynamicSeoOverrides | null) {
  window.dispatchEvent(new CustomEvent(CUSTOM_SEO_EVENT, { detail: overrides }));
}

function setMetaTag(selectorAttr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${selectorAttr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(selectorAttr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalLink(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function setRouteJsonLd(data: Record<string, any> | null) {
  const existing = document.getElementById('aihim-route-ld');
  if (!data) {
    if (existing) existing.remove();
    return;
  }
  let script = existing as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'aihim-route-ld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export const SeoHeadManager: React.FC = () => {
  const location = useLocation();
  const [override, setOverride] = React.useState<DynamicSeoOverrides | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<DynamicSeoOverrides | null>;
      setOverride(custom.detail || null);
    };
    window.addEventListener(CUSTOM_SEO_EVENT, handler);
    return () => window.removeEventListener(CUSTOM_SEO_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith('/blog/')) {
      setOverride(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    const origin = window.location.origin;
    const path = location.pathname;

    let title = 'AIhim — Симулятор алхимии на базе ИИ | Объединяй элементы';
    let description =
      'AIhim — интерактивный симулятор алхимии на основе искусственного интеллекта. Объединяйте стихии, управляйте фазами дня и ночи, закаляйте элементы в кузне и открывайте новые формулы.';
    let keywords =
      'AIhim, Айхим, алхимия ИИ, симулятор алхимии, объединение элементов, трансмутация, кузня, арканы';
    let ogType: 'website' | 'article' = 'website';
    let ogImage = `${origin}/file/53/og_banner_1200x630.jpg`;
    let canonical = `${origin}${path}`;
    let jsonLd: Record<string, any> | null = null;

    if (path === '/') {
      title = 'AIhim — Алхимический стол | Симулятор алхимии на ИИ';
      description =
        'Трансмутируйте элементы на алхимическом столе AIhim. Уникальный симулятор алхимии на базе ИИ: первоматерия, кузня, слова силы и фазы мира.';
    } else if (path === '/blog') {
      title = 'Журнал алхимика AIhim — Статьи, рецепты и гайды по алхимии ИИ';
      description =
        'Полезные статьи о нейросетевой алхимии AIhim: гайды для новичков, латинские слова силы, 12 слоёв реальности, кузня и мобильное приложение PWA.';
      keywords =
        'блог AIhim, статьи алхимия ИИ, гайд Айхим, рецепты алхимии, 12 слоев реальности, PWA алхимия';
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Журнал алхимика AIhim',
        url: `${origin}/blog`,
        description
      };
    } else if (path.startsWith('/rate')) {
      title = 'AIhim — Рейтинг алхимиков и тарифы энергии';
      description =
        'Зал славы и рейтинг великих алхимиков мира в реальном времени, а также пакеты энергии AiHim.';
    } else if (path.startsWith('/maintenance')) {
      title = 'AIhim — Кузня элементов | Стабилизация и нагрев';
      description =
        'В кузне AIhim вы нагреваете, охлаждаете и закаляете элементы, повышая уровень мастерства и стабильность материи.';
    } else if (path.startsWith('/profile')) {
      title = 'AIhim — Профиль алхимика, PWA и уведомления';
      description =
        'Личный кабинет алхимика AIhim: ранг, история трансмутаций, рефералы, установка PWA на Android и iPhone и настройка пуш-уведомлений.';
    } else if (path.startsWith('/arcana')) {
      title = 'AIhim — Колесо Аркан и тайны мироздания';
      description =
        'Арканические связи, законы мироздания, заклинания и настройка вселенной в симуляторе AIhim.';
    } else if (path.startsWith('/oferta')) {
      title = 'AIhim — Публичная оферта ООО «РентРоп»';
      description = 'Официальный договор оферты и условия использования сервиса AIhim.';
    }

    if (override) {
      if (override.title) title = override.title;
      if (override.description) description = override.description;
      if (override.keywords) keywords = override.keywords;
      if (override.ogType) ogType = override.ogType;
      if (override.ogImage) {
        ogImage = override.ogImage.startsWith('http')
          ? override.ogImage
          : `${origin}${override.ogImage.startsWith('/') ? '' : '/'}${override.ogImage}`;
      }
      if (override.canonical) {
        canonical = override.canonical.startsWith('http')
          ? override.canonical
          : `${origin}${override.canonical.startsWith('/') ? '' : '/'}${override.canonical}`;
      }
      if (override.jsonLd !== undefined) jsonLd = override.jsonLd;
    }

    document.title = title;
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'keywords', keywords);
    setCanonicalLink(canonical);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonical);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);
    setRouteJsonLd(jsonLd);
  }, [location.pathname, override]);

  return null;
};
