import { DocumentationSection } from '../data/documentationContent';
import './TableOfContents.css';

interface TableOfContentsProps {
  sections: DocumentationSection[];
  onNavigate: (sectionId: string, subsectionId: string) => void;
  currentSection?: string;
  currentSubsection?: string;
}

export function TableOfContents({ 
  sections, 
  onNavigate, 
  currentSection,
  currentSubsection 
}: TableOfContentsProps) {
  return (
    <div className="table-of-contents">
      <h2 className="toc-title">Inhaltsverzeichnis</h2>
      <nav className="toc-nav">
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className="toc-section">
            <button
              className={`toc-section-title ${currentSection === section.id ? 'active' : ''}`}
              onClick={() => {
                if (section.subsections.length > 0) {
                  onNavigate(section.id, section.subsections[0].id);
                }
              }}
            >
              <span className="toc-section-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
              <span className="toc-section-text">{section.title}</span>
              <span className="toc-section-count">({section.subsections.length})</span>
            </button>
            <div className="toc-subsections">
              {section.subsections.map((subsection, subIndex) => (
                <button
                  key={subsection.id}
                  className={`toc-subsection ${currentSubsection === subsection.id ? 'active' : ''}`}
                  onClick={() => onNavigate(section.id, subsection.id)}
                >
                  <span className="toc-subsection-number">
                    {sectionIndex + 1}.{subIndex + 1}
                  </span>
                  <span className="toc-subsection-text">{subsection.title}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
