import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../App.css';
import './Documentation.css';
import { documentationContent, DocumentationSection } from '../data/documentationContent';
import { EnhancedSearch } from '../components/EnhancedSearch';
import { TableOfContents } from '../components/TableOfContents';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { RelatedContent } from '../components/RelatedContent';
import { Callout } from '../components/Callout';
import { GoodwillCalculator } from '../components/GoodwillCalculator';

const documentation: DocumentationSection[] = documentationContent;

// Helper to parse callouts from content
type ContentPart = 
  | { type: 'text'; content: string }
  | { type: 'callout'; content: string; calloutType: 'warning' | 'tip' | 'info' | 'success' | 'hgb' };

const parseContent = (content: string): ContentPart[] => {
  const parts: ContentPart[] = [];
  const calloutRegex = /\[(WARNING|TIP|INFO|SUCCESS|HGB):(.*?)\]/gs;
  let lastIndex = 0;
  let match;

  while ((match = calloutRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
    }
    
    const calloutType = match[1].toLowerCase() as 'warning' | 'tip' | 'info' | 'success' | 'hgb';
    parts.push({ 
      type: 'callout', 
      content: match[2].trim(),
      calloutType 
    });
    
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.substring(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
};

export default function Documentation() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lastViewed, setLastViewed] = useState<Array<{ sectionId: string; subsectionId: string; title: string }>>([]);

  // Load last viewed from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('documentation-last-viewed');
    if (stored) {
      try {
        setLastViewed(JSON.parse(stored));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save to last viewed when section changes
  useEffect(() => {
    if (selectedSection && selectedSubsection) {
      const section = documentation.find(s => s.id === selectedSection);
      const subsection = section?.subsections.find(s => s.id === selectedSubsection);
      
      if (subsection) {
        const newItem = {
          sectionId: selectedSection,
          subsectionId: selectedSubsection,
          title: `${section?.title} - ${subsection.title}`
        };
        
        setLastViewed(prev => {
          const filtered = prev.filter(item => 
            !(item.sectionId === selectedSection && item.subsectionId === selectedSubsection)
          );
          const updated = [newItem, ...filtered].slice(0, 5); // Keep last 5
          localStorage.setItem('documentation-last-viewed', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [selectedSection, selectedSubsection]);

  const handleNavigate = (sectionId: string, subsectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedSubsection(subsectionId);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const currentSubsection = useMemo(() => {
    if (!selectedSection || !selectedSubsection) return null;
    const section = documentation.find(s => s.id === selectedSection);
    return section?.subsections.find(s => s.id === selectedSubsection) || null;
  }, [selectedSection, selectedSubsection]);

  const currentSection = useMemo(() => {
    if (!selectedSection) return null;
    return documentation.find(s => s.id === selectedSection) || null;
  }, [selectedSection]);

  const renderContent = (content: string) => {
    const parts = parseContent(content);
    
    return parts.map((part, partIndex) => {
      if (part.type === 'callout') {
        return (
          <Callout key={partIndex} type={part.calloutType}>
            {part.content.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </Callout>
        );
      }

      return part.content.split('\n\n').map((paragraph, index) => {
        if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
          const text = paragraph.slice(2, -2);
          return <h2 key={`${partIndex}-${index}`}>{text}</h2>;
        }
        if (paragraph.match(/^\d+\.\s/)) {
          return (
            <ol key={`${partIndex}-${index}`} className="documentation-list">
              {paragraph.split('\n').filter(p => p.trim()).map((item, i) => (
                <li key={i}>{item.replace(/^\d+\.\s/, '')}</li>
              ))}
            </ol>
          );
        }
        if (paragraph.startsWith('- ')) {
          return (
            <ul key={`${partIndex}-${index}`} className="documentation-list">
              {paragraph.split('\n').filter(p => p.trim()).map((item, i) => (
                <li key={i}>{item.replace(/^-\s/, '')}</li>
              ))}
            </ul>
          );
        }
        return <p key={`${partIndex}-${index}`}>{paragraph}</p>;
      });
    });
  };

  return (
    <div className="documentation-page">
      <div className="documentation-container">
        <div className="documentation-sidebar">
          <div className="documentation-header">
            <h1>Dokumentation</h1>
            <p className="documentation-subtitle">Konzern - Konsolidierte Jahresabschlüsse nach HGB</p>
          </div>

          <div className="documentation-search">
            <EnhancedSearch 
              sections={documentation}
              onNavigate={handleNavigate}
            />
          </div>

          {lastViewed.length > 0 && (
            <div className="last-viewed-section">
              <h3 className="last-viewed-title">Zuletzt angesehen</h3>
              <div className="last-viewed-list">
                {lastViewed.map((item, index) => (
                  <button
                    key={index}
                    className="last-viewed-item"
                    onClick={() => handleNavigate(item.sectionId, item.subsectionId)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <nav className="documentation-nav">
            {documentation.map((section) => (
              <div key={section.id} className="documentation-nav-section">
                <button
                  className={`documentation-nav-section-title ${selectedSection === section.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSection(selectedSection === section.id ? null : section.id);
                    if (selectedSection !== section.id) {
                      setSelectedSubsection(section.subsections[0]?.id || null);
                    }
                  }}
                >
                  {section.title}
                </button>
                {selectedSection === section.id && (
                  <div className="documentation-nav-subsections">
                    {section.subsections.map((subsection) => (
                      <button
                        key={subsection.id}
                        className={`documentation-nav-subsection ${selectedSubsection === subsection.id ? 'active' : ''}`}
                        onClick={() => setSelectedSubsection(subsection.id)}
                      >
                        {subsection.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="documentation-content" ref={contentRef}>
          <ProgressIndicator contentRef={contentRef} />
          
          {currentSubsection ? (
            <>
              <div className="documentation-breadcrumb">
                <Link to="/">Dashboard</Link>
                <span> / </span>
                <span>Dokumentation</span>
                {selectedSection && (
                  <>
                    <span> / </span>
                    <span>{currentSection?.title}</span>
                  </>
                )}
                {selectedSubsection && (
                  <>
                    <span> / </span>
                    <span>{currentSubsection.title}</span>
                  </>
                )}
              </div>

              <article className="documentation-article">
                <div className="documentation-article-header">
                  <h1>{currentSubsection.title}</h1>
                  {currentSubsection.lastUpdated && (
                    <div className="last-updated">
                      Zuletzt aktualisiert: {new Date(currentSubsection.lastUpdated).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>

                {currentSubsection.tldr && (
                  <div className="tldr-section">
                    <h2 className="tldr-title">Zusammenfassung</h2>
                    <p className="tldr-content">{currentSubsection.tldr}</p>
                  </div>
                )}

                {currentSubsection.useCases && currentSubsection.useCases.length > 0 && (
                  <div className="use-cases-section">
                    <h2 className="use-cases-title">Anwendungsfälle</h2>
                    <div className="use-cases-list">
                      {currentSubsection.useCases.map((useCase, index) => (
                        <div key={index} className="use-case-item">
                          <span className="use-case-role">
                            {useCase.role === 'wp' && '👔 Wirtschaftsprüfer'}
                            {useCase.role === 'buchhalter' && '📊 Bilanzbuchhalter'}
                            {useCase.role === 'controller' && '📈 Controller'}
                            {useCase.role === 'geschäftsführung' && '💼 Geschäftsführung'}
                          </span>
                          <p className="use-case-description">{useCase.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="documentation-content-body">
                  {renderContent(currentSubsection.content)}
                  
                  {currentSubsection.id === 'first-consolidation' && (
                    <GoodwillCalculator />
                  )}
                  
                  {currentSubsection.screenshot && (
                    <div className="documentation-screenshot">
                      <div className="documentation-screenshot-placeholder">
                        <p>Screenshot: {currentSubsection.screenshot}</p>
                        <p className="documentation-note">Hinweis: Screenshot wird hier angezeigt, sobald verfügbar.</p>
                      </div>
                    </div>
                  )}
                  
                  {currentSubsection.example && (
                    <div className="documentation-example">
                      <h3>Beispiel</h3>
                      <div className="documentation-example-content">
                        <p>{currentSubsection.example}</p>
                      </div>
                    </div>
                  )}
                </div>

                <RelatedContent
                  currentSubsection={currentSubsection}
                  sections={documentation}
                  onNavigate={handleNavigate}
                />
              </article>
            </>
          ) : (
            <div className="documentation-welcome">
              <h1>Willkommen in der Dokumentation</h1>
              <p>Wählen Sie einen Abschnitt aus der linken Navigation aus, um zu beginnen.</p>
              <p>Oder verwenden Sie die Suchfunktion, um nach spezifischen Themen zu suchen.</p>

              <TableOfContents
                sections={documentation}
                onNavigate={handleNavigate}
              />

              <div className="documentation-quick-links">
                <h2>Schnellzugriff</h2>
                <div className="documentation-quick-links-grid">
                  {documentation.slice(0, 6).map((section) => (
                    <button
                      key={section.id}
                      className="documentation-quick-link-card"
                      onClick={() => handleNavigate(section.id, section.subsections[0]?.id || '')}
                    >
                      <h3>{section.title}</h3>
                      <p>{section.subsections.length} Abschnitte</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
