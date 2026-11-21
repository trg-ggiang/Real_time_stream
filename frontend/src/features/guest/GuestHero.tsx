import { useEffect, useState } from 'react';
import './guest-hero.css';

const slides = [
  { src: '/images/guest/campus-bright-1000.jpg', alt: 'Minh họa sinh viên cùng trao đổi trong khuôn viên trường', caption: 'Gặp nhau từ những điều chung.' },
  { src: '/images/hust/sinno-cover.webp', alt: 'Các thành viên câu lạc bộ SINNO', caption: 'Cùng biến ý tưởng thành trải nghiệm.' },
  { src: '/images/hust/hbac-cover.webp', alt: 'Các thành viên câu lạc bộ HBAC', caption: 'Thêm kết nối. Thêm những kỷ niệm.' },
  { src: '/images/guest/tech.jpg', alt: 'Cùng chia sẻ ý tưởng bên máy tính', caption: 'Bắt đầu từ một ý tưởng chung.' },
];

export function GuestHero() {
  return <section className="guest-hero guest-hero-panel" aria-labelledby="guest-title">
    <div className="guest-hero-copy">
      <p className="guest-overline">Cộng đồng sinh viên</p>
      <h1 id="guest-title">Tìm cộng đồng.<br /><span>Mở lối đam mê.</span></h1>
      <p>Khám phá câu lạc bộ, tham gia hoạt động và gặp những người cùng sở thích.</p>
      <div className="guest-hero-actions"><a className="guest-primary" href="#guest-clubs">Khám phá CLB</a><a href="#guest-activities">Xem hoạt động</a></div>
    </div>
    <GuestHeroCarousel />
    <div className="guest-hero-bottom-effect" aria-hidden="true"><span /><span /><span /></div>
  </section>;
}

export function GuestHeroCarousel() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrent(index => (index + 1) % slides.length), 5000);
    return () => window.clearTimeout(timer);
  }, [current]);

  return <div className="guest-hero-carousel" role="region" aria-roledescription="trình chiếu" aria-label="Cộng đồng sinh viên Bách khoa">
      <div className="guest-hero-slides">
        {slides.map((slide, index) => <div key={slide.src} className={`guest-hero-slide${current === index ? ' is-current' : index === (current + slides.length - 1) % slides.length ? ' is-previous' : ''}`} aria-hidden={current !== index && index !== (current + slides.length - 1) % slides.length}>
          <img src={slide.src} alt={slide.alt} width="1200" height="900" fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} />
        </div>)}
      </div>
      <div className="guest-hero-slide-footer">
        <p>{slides[current].caption}</p>
        <span className="guest-hero-slide-number" aria-hidden="true">0{current + 1} / 0{slides.length}</span>
      </div>
      <div className="guest-hero-slide-tabs" aria-label="Chọn ảnh">
        {slides.map((slide, index) => <button type="button" key={slide.src} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={current === index} onClick={() => setCurrent(index)}>
          <span />
        </button>)}
      </div>
    </div>;
}
