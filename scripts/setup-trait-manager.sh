#!/bin/bash

# Setup script for streamlined trait management system
echo "🎨 Setting up Streamlined Trait Management System..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public/trait-images
mkdir -p public/trait-previews
mkdir -p uploads/traits

# Set permissions
chmod 755 public/trait-images
chmod 755 public/trait-previews
chmod 755 uploads/traits

echo "✅ Directories created successfully!"

# Check if required dependencies are installed
echo "📦 Checking dependencies..."

# Check for required npm packages
REQUIRED_PACKAGES=("zod" "multer" "@types/multer")
MISSING_PACKAGES=()

for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! npm list "$package" > /dev/null 2>&1; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo "⚠️  Missing packages detected. Installing..."
    npm install "${MISSING_PACKAGES[@]}"
    echo "✅ Dependencies installed!"
else
    echo "✅ All dependencies are already installed!"
fi

# Create sample trait structure
echo "📋 Creating sample trait structure..."
cat > public/trait-structure-example.md << 'EOF'
# Trait Upload Structure Examples

## File Naming Formats

### Format 1: Folder Structure
```
Clothes/
├── Hoodie.png
├── T-Shirt.png
└── Tank Top.png

Background/
├── Blue Sky.png
├── Forest.png
└── City.png
```

### Format 2: Dash Separated
```
Clothes - Hoodie.png
Clothes - T-Shirt.png
Background - Blue Sky.png
Background - Forest.png
```

### Format 3: Underscore Separated
```
Clothes_Hoodie.png
Clothes_T-Shirt.png
Background_Blue_Sky.png
Background_Forest.png
```

## Bulk Upload Tips

1. **Consistent Naming**: Use the same format for all files in a batch
2. **Image Quality**: Use PNG files with transparent backgrounds for best results
3. **File Size**: Keep images under 10MB each
4. **Layer Order**: Remember that lower numbers appear behind higher numbers
5. **Categories**: Make sure your trait types match your configured categories

## Supported Formats
- PNG (recommended for transparency)
- JPG/JPEG
- GIF
- WebP

## Best Practices
- Use descriptive trait names
- Keep consistent image dimensions within each category
- Test with a small batch first
- Backup your images before bulk upload
EOF

echo "✅ Sample structure guide created at public/trait-structure-example.md"

# Create a simple test script
echo "🧪 Creating test script..."
cat > scripts/test-trait-upload.js << 'EOF'
// Simple test script for trait upload functionality
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Trait Upload System...');

// Test file parsing
function testFileNameParsing() {
    console.log('\n📝 Testing file name parsing...');
    
    const testFiles = [
        'Clothes/Hoodie.png',
        'Background - Blue Sky.png',
        'Eyes_Green.png',
        'SimpleHat.png'
    ];
    
    testFiles.forEach(fileName => {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
        let traitType = '';
        let value = '';
        
        if (nameWithoutExt.includes('/')) {
            [traitType, value] = nameWithoutExt.split('/');
        } else if (nameWithoutExt.includes(' - ')) {
            [traitType, value] = nameWithoutExt.split(' - ');
        } else if (nameWithoutExt.includes('_')) {
            [traitType, value] = nameWithoutExt.split('_');
        } else {
            traitType = 'Unknown';
            value = nameWithoutExt;
        }
        
        console.log(`  ${fileName} → Type: "${traitType.trim()}", Value: "${value.trim()}"`);
    });
}

// Test directory structure
function testDirectoryStructure() {
    console.log('\n📁 Testing directory structure...');
    
    const requiredDirs = [
        'public/trait-images',
        'public/trait-previews',
        'uploads/traits'
    ];
    
    requiredDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`  ✅ ${dir} exists`);
        } else {
            console.log(`  ❌ ${dir} missing`);
        }
    });
}

// Run tests
testFileNameParsing();
testDirectoryStructure();

console.log('\n✅ Test completed!');
EOF

chmod +x scripts/test-trait-upload.js

echo "✅ Test script created at scripts/test-trait-upload.js"

# Create environment variables template
echo "⚙️  Creating environment template..."
cat >> .env.local.example << 'EOF'

# Trait Management Configuration
TRAIT_UPLOAD_MAX_SIZE=10485760
TRAIT_UPLOAD_ALLOWED_TYPES=image/png,image/jpeg,image/gif,image/webp
TRAIT_STORAGE_PATH=public/trait-images
TRAIT_PREVIEW_PATH=public/trait-previews

# Image Processing
ENABLE_IMAGE_OPTIMIZATION=true
GENERATE_THUMBNAILS=true
THUMBNAIL_SIZE=200

# Bulk Upload Limits
MAX_BULK_UPLOAD_FILES=100
BULK_UPLOAD_TIMEOUT=300000
EOF

echo "✅ Environment template updated!"

# Final instructions
echo ""
echo "🎉 Streamlined Trait Management Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Visit /admin/traits-manager to access the new comprehensive trait manager"
echo "2. Use the Layer Order tab to configure your trait categories"
echo "3. Use the Bulk Upload tab to upload multiple traits at once"
echo "4. Check the sample structure guide at public/trait-structure-example.md"
echo "5. Run 'node scripts/test-trait-upload.js' to test the system"
echo ""
echo "🔗 Available Routes:"
echo "   • /admin/traits-manager - Comprehensive trait management"
echo "   • /admin/traits - Original trait management (still available)"
echo "   • /api/admin/traits/bulk - Bulk upload API"
echo "   • /api/admin/trait-slots - Layer/category management API"
echo ""
echo "💡 Features Added:"
echo "   ✅ Drag & drop layer ordering"
echo "   ✅ Bulk trait upload with file parsing"
echo "   ✅ Category management"
echo "   ✅ Artist commission support"
echo "   ✅ Pricing in multiple tokens (SPEGOD/SLDZ)"
echo "   ✅ Inventory management"
echo "   ✅ File validation and preview"
echo ""
echo "Happy trait managing! 🎨"