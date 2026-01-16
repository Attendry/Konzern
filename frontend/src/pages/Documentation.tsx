import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import '../App.css';
import './Documentation.css';
import { documentationContent, DocumentationSection } from '../data/documentationContent';

const documentation: DocumentationSection[] = documentationContent;

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null);

  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return documentation;
    }

    const query = searchQuery.toLowerCase();
    return documentation
      .map(section => ({
        ...section,
        subsections: section.subsections.filter(sub =>
          sub.title.toLowerCase().includes(query) ||
          sub.content.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.subsections.length > 0);
  }, [searchQuery]);

  const currentSubsection = useMemo(() => {
    if (!selectedSection || !selectedSubsection) return null;
    const section = documentation.find(s => s.id === selectedSection);
    return section?.subsections.find(s => s.id === selectedSubsection) || null;
  }, [selectedSection, selectedSubsection]);

  return (
    <div className="documentation-page">
      <div className="documentation-container">
        <div className="documentation-sidebar">
          <div className="documentation-header">
            <h1>Dokumentation</h1>
            <p className="documentation-subtitle">Konzern - Konsolidierte Jahresabschlüsse nach HGB</p>
          </div>

          <div className="documentation-search">
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="documentation-search-input"
            />
          </div>

          <nav className="documentation-nav">
            {filteredContent.map((section) => (
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

        <div className="documentation-content">
          {currentSubsection ? (
            <>
              <div className="documentation-breadcrumb">
                <Link to="/">Dashboard</Link>
                <span> / </span>
                <span>Dokumentation</span>
                {selectedSection && (
                  <>
                    <span> / </span>
                    <span>{documentation.find(s => s.id === selectedSection)?.title}</span>
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
                <h1>{currentSubsection.title}</h1>
                <div className="documentation-content-body">
                  {currentSubsection.content.split('\n\n').map((paragraph, index) => {
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      const text = paragraph.slice(2, -2);
                      return <h2 key={index}>{text}</h2>;
                    }
                    if (paragraph.match(/^\d+\.\s/)) {
                      return (
                        <ol key={index} className="documentation-list">
                          {paragraph.split('\n').filter(p => p.trim()).map((item, i) => (
                            <li key={i}>{item.replace(/^\d+\.\s/, '')}</li>
                          ))}
                        </ol>
                      );
                    }
                    if (paragraph.startsWith('- ')) {
                      return (
                        <ul key={index} className="documentation-list">
                          {paragraph.split('\n').filter(p => p.trim()).map((item, i) => (
                            <li key={i}>{item.replace(/^-\s/, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={index}>{paragraph}</p>;
                  })}
                  
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
              </article>
            </>
          ) : (
            <div className="documentation-welcome">
              <h1>Willkommen in der Dokumentation</h1>
              <p>Wählen Sie einen Abschnitt aus der linken Navigation aus, um zu beginnen.</p>
              <p>Oder verwenden Sie die Suchfunktion, um nach spezifischen Themen zu suchen.</p>

              <div className="documentation-quick-links">
                <h2>Schnellzugriff</h2>
                <div className="documentation-quick-links-grid">
                  {documentation.slice(0, 6).map((section) => (
                    <button
                      key={section.id}
                      className="documentation-quick-link-card"
                      onClick={() => {
                        setSelectedSection(section.id);
                        setSelectedSubsection(section.subsections[0]?.id || null);
                      }}
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
