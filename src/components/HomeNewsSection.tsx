import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

// Supabase Client(App.tsx と同じインスタンスを使う場合は props で受け取る形にもできる)
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const supabase = createClient(
  SUPABASE_URL,
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

interface BlogPost {
  id: string;
  title: string;
  cover_image_url: string | null;
  author_id: string;
  created_at: string;
  likes_count: number;
}

interface GalleryPost {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  likes_count: number;
  created_at: string;
}

interface Community {
  id: string;
  name: string;
  icon: string | null;
  cover_image_url: string | null;
  member_count: number;
  message_count: number;
  category: string | null;
}

// 経過時間表示
function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return date.toLocaleDateString('ja-JP');
}

export default function HomeNewsSection() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [gallery, setGallery] = useState<GalleryPost[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [blogResult, galleryResult, communityResult] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id, title, cover_image_url, author_id, created_at, likes_count')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('gallery_posts')
          .select('id, image_url, caption, user_id, likes_count, created_at')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('communities')
          .select('id, name, icon, cover_image_url, member_count, message_count, category')
          .eq('is_archived', false)
          .order('message_count', { ascending: false })
          .limit(4),
      ]);

      if (blogResult.data) setBlogs(blogResult.data);
      if (galleryResult.data) setGallery(galleryResult.data);
      if (communityResult.data) setCommunities(communityResult.data);
    } catch (error) {
      console.error('HomeNewsSection load error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ローディング中・全部空なら何も表示しない
  if (loading) return null;
  if (blogs.length === 0 && gallery.length === 0 && communities.length === 0) return null;

  // ===== スタイル =====
  const sectionWrapper: React.CSSProperties = {
    padding: '32px 16px',
    backgroundColor: '#FAFAFA',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: '#999',
    letterSpacing: '0.1em',
    textAlign: 'center',
    marginBottom: '8px',
    margin: 0,
  };

  const sectionHeading: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: 700,
    color: '#333',
    textAlign: 'center',
    marginTop: '8px',
    marginBottom: '32px',
  };

  const subsection: React.CSSProperties = {
    marginBottom: '32px',
  };

  const subsectionHeader: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '0 4px',
  };

  const subsectionTitle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    color: '#333',
    margin: 0,
  };

  const seeAllLink: React.CSSProperties = {
    fontSize: '13px',
    color: '#F5A94A',
    textDecoration: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  };

  const scrollContainer: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '8px',
    paddingLeft: '4px',
    paddingRight: '4px',
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  const blogCard: React.CSSProperties = {
    flexShrink: 0,
    width: '180px',
    scrollSnapAlign: 'start',
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  };

  const blogImage: React.CSSProperties = {
    width: '100%',
    height: '110px',
    objectFit: 'cover',
    backgroundColor: '#F5A94A20',
  };

  const blogImagePlaceholder: React.CSSProperties = {
    ...blogImage,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  };

  const blogContent: React.CSSProperties = {
    padding: '12px',
  };

  const blogTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    margin: 0,
    marginBottom: '8px',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const blogMeta: React.CSSProperties = {
    fontSize: '11px',
    color: '#999',
  };

  // 依頼書 #38 Phase A: Instagram Explore 完全再現
  // - width:100% + minWidth:0 で Grid item として確実に grid 計算に乗る
  // - aspectRatio: 1/1 で正方形タイル
  // - margin/padding 0 で隙間 gap だけ
  const galleryCard: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    backgroundColor: '#F5A94A20',
    margin: 0,
    padding: 0,
    display: 'block',
  };

  const galleryImage: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  const galleryOverlay: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px 10px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
    color: 'white',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const communityCard: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const communityIcon: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#F5A94A20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
    overflow: 'hidden',
  };

  const communityInfo: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const communityName: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: '#333',
    margin: 0,
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const communityMeta: React.CSSProperties = {
    fontSize: '12px',
    color: '#999',
    display: 'flex',
    gap: '12px',
  };

  return (
    <div style={sectionWrapper}>
      {/* セクションタイトル */}
      <p style={sectionTitle}>QOCCA NEWS</p>
      <h2 style={sectionHeading}>みんなの新着</h2>

      {/* スクロールバー非表示 */}
      <style>{`
        .qocca-scroll-x::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ===== ブログ ===== */}
      {blogs.length > 0 && (
        <div style={subsection}>
          <div style={subsectionHeader}>
            <h3 style={subsectionTitle}>📝 みんなのブログ</h3>
            <button
              style={seeAllLink}
              onClick={() => navigate('/blogs')}
            >
              すべて見る →
            </button>
          </div>
          <div style={scrollContainer} className="qocca-scroll-x">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                style={blogCard}
                onClick={() => navigate(`/blog/${blog.id}`)}
              >
                {blog.cover_image_url ? (
                  <img
                    src={blog.cover_image_url}
                    alt={blog.title}
                    style={blogImage}
                    loading="lazy"
                  />
                ) : (
                  <div style={blogImagePlaceholder}>📝</div>
                )}
                <div style={blogContent}>
                  <h4 style={blogTitle}>{blog.title}</h4>
                  <div style={blogMeta}>
                    {timeAgo(blog.created_at)}
                    {blog.likes_count > 0 && ` ・ ❤️ ${blog.likes_count}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 📸 みんなのギャラリー (依頼書 #35: Instagram グリッド化) ===== */}
      {gallery.length > 0 && (
        <div style={subsection}>
          <div style={subsectionHeader}>
            <h3 style={subsectionTitle}>📸 みんなのギャラリー</h3>
            <button
              style={seeAllLink}
              onClick={() => navigate('/gallery')}
            >
              すべて見る →
            </button>
          </div>
          {/* 依頼書 #38 Phase A: inline grid 直書きで確実に 3列保証
              PC オーバーライドは index.css の !important media query */}
          <div
            className="qocca-home-gallery-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 2,
              width: "100%",
              margin: 0,
              padding: 0,
            }}
          >
            {gallery.map((item) => (
              <div
                key={item.id}
                style={galleryCard}
                onClick={() => navigate('/gallery')}
              >
                <img
                  src={item.image_url}
                  alt={item.caption || 'ギャラリー'}
                  style={galleryImage}
                  loading="lazy"
                />
                {item.likes_count > 0 && (
                  <div style={galleryOverlay}>
                    ❤️ {item.likes_count}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== コミュニティ ===== */}
      {communities.length > 0 && (
        <div style={subsection}>
          <div style={subsectionHeader}>
            <h3 style={subsectionTitle}>💬 アクティブなコミュニティ</h3>
            <button
              style={seeAllLink}
              onClick={() => navigate('/communities')}
            >
              すべて見る →
            </button>
          </div>
          <div>
            {communities.map((community) => (
              <div
                key={community.id}
                style={communityCard}
                onClick={() => navigate(`/community/${community.id}`)}
              >
                <div style={communityIcon}>
                  {community.cover_image_url ? (
                    <img
                      src={community.cover_image_url}
                      alt={community.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : community.icon ? (
                    <span>{community.icon}</span>
                  ) : (
                    <span>💬</span>
                  )}
                </div>
                <div style={communityInfo}>
                  <h4 style={communityName}>{community.name}</h4>
                  <div style={communityMeta}>
                    <span>👥 {community.member_count || 0}人</span>
                    <span>💬 {community.message_count || 0}件</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
