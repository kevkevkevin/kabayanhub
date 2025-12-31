declare module 'react-quill-new' {
  import React from 'react';
  export interface ReactQuillProps {
    theme?: string;
    modules?: any;
    formats?: string[];
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    readOnly?: boolean;
    onChange?: (value: string, delta: any, source: string, editor: any) => void;
    className?: string;
    style?: React.CSSProperties; 
  }
  const ReactQuill: React.FC<ReactQuillProps>;
  export default ReactQuill;
}