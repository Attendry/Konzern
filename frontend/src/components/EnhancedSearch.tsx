import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocumentationSection, DocumentationSubsection } from '../data/documentationContent';
import './EnhancedSearch.css';

interface EnhancedSearchProps {
  sections: DocumentationSection[];
  onNavigate: (sectionId: string, subsectionId: string) => void;
  onClose?: () => void;
}

interface SearchResult {
  section: DocumentationSection;
  subsection: DocumentationSubsection;
  matchType: 'title' | 'content' | 'tldr';
  score: number;
}

export function EnhancedSearch({ sections, onNavigate, onClose }: EnhancedSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const searchResults: SearchResult[] = [];

    sections.forEach(section => {
      section.subsections.forEach(subsection => {
        let score = 0;
        let matchType: 'title' | 'content' | 'tldr' = 'content';

        const titleLower = subsection.title.toLowerCase();
        const contentLower = subsection.content.toLowerCase();
        const tldrLower = subsection.tldr?.toLowerCase() || '';

        searchTerms.forEach(term => {
          // Title matches get highest score
          if (titleLower.includes(term)) {
            score += 10;
            matchType = 'title';
          }
          // TL;DR matches get medium score
          if (tldrLower.includes(term)) {
            score += 5;
            if (matchType === 'content') matchType = 'tldr';
          }
          // Content matches get lower score
          if (contentLower.includes(term)) {
            score += 1;
          }
        });

        if (score > 0) {
          searchResults.push({
            section,
            subsection,
            matchType,
            score
          });
        }
      });
    });

    // Sort by score (descending)
    searchResults.sort((a, b) => b.score - a.score);

    return searchResults.slice(0, 10); // Limit to top 10 results
  }, [query, sections]);

  useEffect(() => {
    if (query.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onNavigate(selected.section.id, selected.subsection.id);
        setQuery('');
        setIsOpen(false);
        onClose?.();
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setIsOpen(false);
      onClose?.();
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    let highlighted = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  };

  return (
    <div className="enhanced-search">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder="Suchen... (min. 2 Zeichen)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="enhanced-search-input"
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            aria-label="Suche zurücksetzen"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results" ref={resultsRef}>
          <div className="search-results-header">
            {results.length} Ergebnis{results.length !== 1 ? 'se' : ''} gefunden
          </div>
          {results.map((result, index) => (
            <button
              key={`${result.section.id}-${result.subsection.id}`}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                onNavigate(result.section.id, result.subsection.id);
                setQuery('');
                setIsOpen(false);
                onClose?.();
              }}
            >
              <div className="search-result-header">
                <span className="search-result-section">{result.section.title}</span>
                <span className={`search-result-badge ${result.matchType}`}>
                  {result.matchType === 'title' ? 'Titel' : result.matchType === 'tldr' ? 'Zusammenfassung' : 'Inhalt'}
                </span>
              </div>
              <div 
                className="search-result-title"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(result.subsection.title, query) 
                }}
              />
              {result.subsection.tldr && (
                <div 
                  className="search-result-preview"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightText(result.subsection.tldr.substring(0, 100), query) + '...' 
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="search-no-results">
          Keine Ergebnisse gefunden für "{query}"
        </div>
      )}
    </div>
  );
}
