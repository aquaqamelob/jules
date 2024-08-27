'use client';
import { useState } from 'react';
import { generate } from '@/app/actions';
import { readStreamableValue } from 'ai/rsc';
import { calculateDiff } from '../utils/calculateDiff';
import { createContentWidget } from '../utils/WidgetCreator';
import { promptModal } from '../utils/promptModal';
import { applyEdit } from '../utils/applyEdit';

export const useAIAssist = (editorRef) => {

    const handleAIAssist = (editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, async () => {
            const selection = editor.getSelection();
            const initialText = editor.getModel().getValue();
            const range = new monaco.Range(
                selection.startLineNumber,
                selection.startColumn,
                selection.endLineNumber,
                selection.endColumn
            );
            
            const oldText = editor.getModel().getValueInRange(range);
            const context = `Replace lines ${selection.startLineNumber}-${selection.endLineNumber}:\n${oldText}`;
            
            const userInput = await promptModal(editor, monaco, selection);
            
            const { output } = await generate(`File content:\n${initialText}\n\nContext: ${context}\n\nUser input: ${userInput}`);

            let newText = '';
            let oldDecorations = [];
            let currentLine = selection.startLineNumber; 
            let buffer = '';

            for await (const delta of readStreamableValue(output)) {
                buffer += delta.content;
                if (buffer.endsWith('\n') || buffer.length > 0) {
                    newText += buffer;
                    const { diffText, decorations, currentLine: updatedLine } = calculateDiff(oldText, newText, monaco, selection);
                    currentLine = updatedLine;
                    await applyEdit(editor, initialText, range, diffText);
                    oldDecorations = editor.deltaDecorations(oldDecorations, decorations);
                    buffer = '';
                }
            }

            const contentWidget = createContentWidget(editor, monaco, selection, oldText, newText, currentLine, oldDecorations);
            editor.addContentWidget(contentWidget);
            
        });
    };

    return { handleAIAssist };
};