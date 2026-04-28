const SOURCE_CODE_URL = 'https://github.com/vddgmbh/documenso';

export const SourceCodeFooter = () => {
  return (
    <footer className="border-t py-4 text-center text-xs text-muted-foreground">
      Built on{' '}
      <a
        href="https://documenso.com"
        className="underline hover:text-foreground"
        target="_blank"
        rel="noopener noreferrer"
      >
        Documenso
      </a>
      {' (modified) · '}
      <a
        href={SOURCE_CODE_URL}
        className="underline hover:text-foreground"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source Code
      </a>
      {' · AGPL-3.0'}
    </footer>
  );
};
