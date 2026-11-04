"use client"

import { useState } from "react"
import { Copy, Check, Menu, X, ChevronRight, Terminal, Zap, Settings, Book, Code, Rocket } from "lucide-react"

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const sidebarSections = [
    {
      title: "Getting Started",
      id: "getting-started",
      icon: Rocket,
      items: [
        { title: "Installation", id: "installation" },
        { title: "Quick Start", id: "quick-start" },
        { title: "Configuration", id: "configuration" },
      ],
    },
    {
      title: "Commands",
      id: "commands",
      icon: Terminal,
      items: [
        { title: "hexa-cli init", id: "init" },
        { title: "hexa-cli generate", id: "generate" },
        { title: "hexa-cli review", id: "review" },
        { title: "hexa-cli deploy", id: "deploy" },
      ],
    },
    {
      title: "AI Models",
      id: "models",
      icon: Zap,
      items: [
        { title: "Model Selection", id: "model-selection" },
        { title: "Custom Models", id: "custom-models" },
        { title: "Model Configuration", id: "model-config" },
      ],
    },
    {
      title: "Integrations",
      id: "integrations",
      icon: Settings,
      items: [
        { title: "IDE Setup", id: "ide-setup" },
        { title: "CI/CD Integration", id: "cicd" },
        { title: "Custom Agents", id: "custom-agents" },
      ],
    },
    {
      title: "API Reference",
      id: "api",
      icon: Code,
      items: [
        { title: "CLI API", id: "cli-api" },
        { title: "Configuration API", id: "config-api" },
        { title: "Plugin API", id: "plugin-api" },
      ],
    },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "getting-started":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">Getting Started with HEXA CLI</h1>
              <p className="text-xl text-gray-400 mb-8">
                HEXA CLI is an AI-powered development tool that helps you ship faster from your terminal.
              </p>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 border border-gray-600 flex items-center justify-center">
                  <span className="text-sm font-mono text-white">01</span>
                </div>
                Installation
              </h2>
              <p className="text-gray-400 mb-4">Install HEXA CLI globally using npm:</p>
              <div
                className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                onClick={() => copyToClipboard("npm install -g hexa-cli", "install-cmd")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <span className="text-white">npm install -g hexa-cli</span>
                </div>
                {copiedStates["install-cmd"] ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                )}
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 border border-gray-600 flex items-center justify-center">
                  <span className="text-sm font-mono text-white">02</span>
                </div>
                Quick Start
              </h2>
              <p className="text-gray-400 mb-4">Initialize your first AI-powered project:</p>
              <div className="space-y-3">
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli init my-project", "init-cmd")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli init my-project</span>
                  </div>
                  {copiedStates["init-cmd"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("cd my-project", "cd-cmd")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">cd my-project</span>
                  </div>
                  {copiedStates["cd-cmd"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() =>
                    copyToClipboard("hexa-cli generate --model gpt-5 'Create a React component'", "generate-cmd")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli generate --model gpt-5 "Create a React component"</span>
                  </div>
                  {copiedStates["generate-cmd"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 border border-gray-600 flex items-center justify-center">
                  <span className="text-sm font-mono text-white">03</span>
                </div>
                What's Next?
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div
                  className="border border-gray-700 p-4 hover:border-gray-500 transition-colors cursor-pointer"
                  onClick={() => setActiveSection("configuration")}
                >
                  <h3 className="text-white font-bold mb-2">Configure AI Models</h3>
                  <p className="text-gray-400 text-sm">Set up your preferred AI models and customize settings</p>
                </div>
                <div
                  className="border border-gray-700 p-4 hover:border-gray-500 transition-colors cursor-pointer"
                  onClick={() => setActiveSection("ide-setup")}
                >
                  <h3 className="text-white font-bold mb-2">IDE Integration</h3>
                  <p className="text-gray-400 text-sm">Connect HEXA CLI with your favorite development environment</p>
                </div>
              </div>
            </div>
          </div>
        )

      case "installation":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">Installation</h1>
              <p className="text-xl text-gray-400 mb-8">Multiple ways to install HEXA CLI on your system.</p>
            </div>

            <div className="grid gap-6">
              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">NPM (Recommended)</h3>
                <p className="text-gray-400 mb-4">Install globally for system-wide access:</p>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("npm install -g hexa-cli", "npm-install")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">npm install -g hexa-cli</span>
                  </div>
                  {copiedStates["npm-install"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">Yarn</h3>
                <p className="text-gray-400 mb-4">Alternative package manager installation:</p>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("yarn global add hexa-cli", "yarn-install")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">yarn global add hexa-cli</span>
                  </div>
                  {copiedStates["yarn-install"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">Direct Download</h3>
                <p className="text-gray-400 mb-4">Download pre-built binaries for your platform:</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-black border border-gray-700 hover:border-gray-500 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 w-20">macOS:</span>
                      <code className="text-white">hexa-cli-darwin-x64</code>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors text-sm">Download</button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black border border-gray-700 hover:border-gray-500 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 w-20">Linux:</span>
                      <code className="text-white">hexa-cli-linux-x64</code>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors text-sm">Download</button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black border border-gray-700 hover:border-gray-500 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 w-20">Windows:</span>
                      <code className="text-white">hexa-cli-win-x64.exe</code>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors text-sm">Download</button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">Verification</h3>
                <p className="text-gray-400 mb-4">Verify your installation:</p>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli --version", "version-check")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli --version</span>
                  </div>
                  {copiedStates["version-check"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case "configuration":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">Configuration</h1>
              <p className="text-xl text-gray-400 mb-8">Customize HEXA CLI to match your workflow and preferences.</p>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white">Global Configuration</h2>
              <p className="text-gray-400 mb-4">Set up your global preferences:</p>
              <div className="space-y-3">
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli config set model gpt-5", "config-model")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli config set model gpt-5</span>
                  </div>
                  {copiedStates["config-model"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli config set auto-review true", "config-review")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli config set auto-review true</span>
                  </div>
                  {copiedStates["config-review"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white">Project Configuration</h2>
              <p className="text-gray-400 mb-4">
                Create a <code className="text-white bg-black px-2 py-1">hexa.config.json</code> file in your project
                root:
              </p>
              <div className="bg-black border border-gray-700 p-4 font-mono text-sm">
                <pre className="text-gray-300">{`{
  "model": "claude-4-sonnet",
  "rules": [
    "Use TypeScript for all new files",
    "Follow React best practices",
    "Add comprehensive error handling"
  ],
  "integrations": {
    "ide": "vscode",
    "ci": "github-actions"
  },
  "agents": {
    "reviewer": {
      "model": "claude-4",
      "focus": ["security", "performance"]
    }
  }
}`}</pre>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h2 className="text-2xl font-bold mb-4 text-white">Environment Variables</h2>
              <div className="space-y-4">
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">HEXA_API_KEY</code>
                  <p className="text-gray-400 mt-1">Your HEXA CLI API key for premium features</p>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">HEXA_MODEL</code>
                  <p className="text-gray-400 mt-1">Default AI model to use (overrides config)</p>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">HEXA_DEBUG</code>
                  <p className="text-gray-400 mt-1">Enable debug logging (true/false)</p>
                </div>
              </div>
            </div>
          </div>
        )

      case "generate":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">hexa-cli generate</h1>
              <p className="text-xl text-gray-400 mb-8">
                Generate code, components, and entire features using AI models.
              </p>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">Basic Usage</h3>
              <div
                className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between mb-4"
                onClick={() => copyToClipboard("hexa-cli generate [prompt]", "basic-generate")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <span className="text-white">hexa-cli generate [prompt]</span>
                </div>
                {copiedStates["basic-generate"] ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                )}
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">Options</h3>
              <div className="space-y-4">
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">--model, -m</code>
                  <p className="text-gray-400 mt-1">Specify AI model (gpt-5, claude-4, gemini-2.5)</p>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">--context, -c</code>
                  <p className="text-gray-400 mt-1">Include project context (full, minimal, none)</p>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">--output, -o</code>
                  <p className="text-gray-400 mt-1">Specify output file or directory</p>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <code className="text-white">--interactive, -i</code>
                  <p className="text-gray-400 mt-1">Enable interactive mode for refinements</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">Examples</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 mb-2">Generate a React component:</p>
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() =>
                      copyToClipboard(
                        "hexa-cli generate 'Create a responsive navbar component with dark mode toggle'",
                        "example-navbar",
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">
                        hexa-cli generate "Create a responsive navbar component with dark mode toggle"
                      </span>
                    </div>
                    {copiedStates["example-navbar"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 mb-2">Generate API endpoints:</p>
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() =>
                      copyToClipboard(
                        "hexa-cli generate --model claude-4 'Create REST API for user management with authentication'",
                        "example-api",
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">
                        hexa-cli generate --model claude-4 "Create REST API for user management with authentication"
                      </span>
                    </div>
                    {copiedStates["example-api"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 mb-2">Interactive generation:</p>
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() =>
                      copyToClipboard(
                        "hexa-cli generate --interactive 'Build a dashboard with charts'",
                        "example-interactive",
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">
                        hexa-cli generate --interactive "Build a dashboard with charts"
                      </span>
                    </div>
                    {copiedStates["example-interactive"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "model-selection":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">Model Selection</h1>
              <p className="text-xl text-gray-400 mb-8">Choose and configure AI models for different tasks.</p>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">Available Models</h3>
              <div className="space-y-4">
                <div className="border border-gray-700 p-4 hover:border-gray-500 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold">GPT-5 (OpenAI)</h4>
                    <span className="text-green-400 text-sm">● Active</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Latest OpenAI model with enhanced reasoning and code generation
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Code Generation</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Reasoning</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Fast</span>
                  </div>
                </div>
                <div className="border border-gray-700 p-4 hover:border-gray-500 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold">Claude-4 Sonnet (Anthropic)</h4>
                    <span className="text-green-400 text-sm">● Active</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">Excellent for code review and complex reasoning tasks</p>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Code Review</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Analysis</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Detailed</span>
                  </div>
                </div>
                <div className="border border-gray-700 p-4 hover:border-gray-500 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold">Gemini-2.5 Pro (Google)</h4>
                    <span className="text-green-400 text-sm">● Active</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Great for multimodal tasks and large context understanding
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Multimodal</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Large Context</span>
                    <span className="bg-gray-800 text-gray-300 px-2 py-1">Versatile</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-6">
              <h3 className="text-xl font-bold mb-3 text-white">Model Commands</h3>
              <div className="space-y-3">
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli model list", "model-list")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli model list</span>
                  </div>
                  {copiedStates["model-list"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli model set gpt-5", "model-set")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli model set gpt-5</span>
                  </div>
                  {copiedStates["model-set"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli model status", "model-status")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli model status</span>
                  </div>
                  {copiedStates["model-status"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case "ide-setup":
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">IDE Setup</h1>
              <p className="text-xl text-gray-400 mb-8">Integrate HEXA CLI with your development environment.</p>
            </div>

            <div className="grid gap-6">
              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">VS Code Integration</h3>
                <p className="text-gray-400 mb-4">Install the HEXA CLI extension for VS Code:</p>
                <div className="space-y-3">
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() =>
                      copyToClipboard("code --install-extension hexa-cli.vscode-extension", "vscode-install")
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">code --install-extension hexa-cli.vscode-extension</span>
                    </div>
                    {copiedStates["vscode-install"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    <p>Features:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Inline code generation</li>
                      <li>AI-powered code completion</li>
                      <li>Integrated terminal commands</li>
                      <li>Real-time code review</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">JetBrains IDEs</h3>
                <p className="text-gray-400 mb-4">Compatible with IntelliJ IDEA, WebStorm, PyCharm, and more:</p>
                <div
                  className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                  onClick={() => copyToClipboard("hexa-cli ide setup jetbrains", "jetbrains-setup")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <span className="text-white">hexa-cli ide setup jetbrains</span>
                  </div>
                  {copiedStates["jetbrains-setup"] ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                  )}
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800 p-6">
                <h3 className="text-xl font-bold mb-3 text-white">Terminal Integration</h3>
                <p className="text-gray-400 mb-4">Add shell completions and aliases:</p>
                <div className="space-y-3">
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() => copyToClipboard("hexa-cli completion bash >> ~/.bashrc", "bash-completion")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">hexa-cli completion bash {">"} ~/.bashrc</span>
                    </div>
                    {copiedStates["bash-completion"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                  <div
                    className="bg-black border border-gray-700 p-4 font-mono text-sm cursor-pointer hover:border-gray-500 transition-colors flex items-center justify-between"
                    onClick={() => copyToClipboard("hexa-cli completion zsh >> ~/.zshrc", "zsh-completion")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-white">hexa-cli completion zsh {">"} ~/.zshrc</span>
                    </div>
                    {copiedStates["zsh-completion"] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 text-white">Documentation</h1>
              <p className="text-xl text-gray-400 mb-8">Select a section from the sidebar to get started.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div
                className="bg-gray-950 border border-gray-800 p-6 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => setActiveSection("getting-started")}
              >
                <Rocket className="w-8 h-8 text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Getting Started</h3>
                <p className="text-gray-400">Quick installation and setup guide</p>
              </div>
              <div
                className="bg-gray-950 border border-gray-800 p-6 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => setActiveSection("commands")}
              >
                <Terminal className="w-8 h-8 text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Commands</h3>
                <p className="text-gray-400">Complete CLI command reference</p>
              </div>
              <div
                className="bg-gray-950 border border-gray-800 p-6 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => setActiveSection("models")}
              >
                <Zap className="w-8 h-8 text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">AI Models</h3>
                <p className="text-gray-400">Configure and use different AI models</p>
              </div>
              <div
                className="bg-gray-950 border border-gray-800 p-6 hover:border-gray-600 transition-colors cursor-pointer"
                onClick={() => setActiveSection("integrations")}
              >
                <Settings className="w-8 h-8 text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">Integrations</h3>
                <p className="text-gray-400">IDE setup and workflow integration</p>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <nav className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm p-4 relative z-50 sticky top-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-red-500"></div>
                <div className="w-3 h-3 bg-yellow-500"></div>
                <div className="w-3 h-3 bg-green-500"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-lg">HEXA</span>
                <span className="text-gray-400 text-sm">CLI</span>
              </div>
            </a>
            <div className="text-gray-500 text-sm">/ Documentation</div>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      <div className="flex">
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-80 bg-gray-950 border-r border-gray-800 transition-transform duration-300 ease-in-out overflow-y-auto`}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <Book className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">Documentation</h2>
            </div>

            <nav className="space-y-6">
              {sidebarSections.map((section) => (
                <div key={section.id}>
                  <div
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-700 hover:bg-gray-900 ${
                      activeSection === section.id ? "bg-gray-900 border-gray-600" : ""
                    }`}
                    onClick={() => {
                      setActiveSection(section.id)
                      setSidebarOpen(false)
                    }}
                  >
                    <section.icon className="w-5 h-5 text-gray-400" />
                    <span className="text-white font-medium">{section.title}</span>
                    <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
                  </div>

                  <div className="ml-8 mt-2 space-y-1">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 cursor-pointer text-sm transition-all duration-200 border border-transparent hover:border-gray-700 hover:bg-gray-900 ${
                          activeSection === item.id ? "bg-gray-900 border-gray-600 text-white" : "text-gray-400"
                        }`}
                        onClick={() => {
                          setActiveSection(item.id)
                          setSidebarOpen(false)
                        }}
                      >
                        {item.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 lg:ml-0">
          <div className="max-w-4xl mx-auto p-6 lg:p-12">{renderContent()}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
