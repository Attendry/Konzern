import React from 'react';
import { DocumentationSection, DocumentationSubsection } from '../data/documentationContent';
import './RelatedContent.css';

interface RelatedContentProps {
  currentSubsection: DocumentationSubsection;
  sections: DocumentationSection[];
  onNavigate: (sectionId: string, subsectionId: string) => void;
}

export function RelatedContent({ currentSubsection, sections, onNavigate }: RelatedContentProps) {
  if (!currentSubsection.relatedSections || currentSubsection.relatedSections.length === 0) {
    return null;
  }

  const relatedItems = currentSubsection.relatedSections
    .map(ref => {
      for (const section of sections) {
        const subsection = section.subsections.find(sub => sub.id === ref);
        if (subsection) {
          return { section, subsection };
        }
      }
      return null;
    })
    .filter((item): item is { section: DocumentationSection; subsection: DocumentationSubsection } => item !== null);

  if (relatedItems.length === 0) {
    return null;
  }

  return (
    <div className="related-content">
      <h3 className="related-content-title">Siehe auch</h3>
      <div className="related-content-list">
        {relatedItems.map(({ section, subsection }) => (
          <button
            key={subsection.id}
            className="related-content-item"
            onClick={() => onNavigate(section.id, subsection.id)}
          >
            <span className="related-content-section">{section.title}</span>
            <span className="related-content-subsection">{subsection.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
