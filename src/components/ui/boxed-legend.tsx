'use client'

import React from 'react'

type Item = { label: string; color: string }

type Props = {
    items: Item[]
    dashed?: boolean
    title?: string
}

const BoxedLegend: React.FC<Props> = ({ items, dashed, title }) => {
    return (
        <div
            style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 8,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                minWidth: 140,
            }}
            className="text-sm"
        >
            {title && <div className="mb-2 font-medium opacity-80">{title}</div>}
            <div className="flex flex-col gap-2">
                {items.map((it) => (
                    <div key={it.label} className="flex items-center gap-2">
                        {dashed ? (
                            <span
                                style={{
                                    borderBottom: `2px dashed ${it.color}`,
                                    width: 18,
                                    display: 'inline-block',
                                    height: 0,
                                }}
                            />
                        ) : (
                            <span
                                style={{
                                    background: it.color,
                                    width: 18,
                                    height: 2,
                                    display: 'inline-block',
                                }}
                            />
                        )}
                        <span>{it.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default BoxedLegend
