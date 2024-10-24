#include <string>
#include <vector>
#include <cstring>
#include <cstdint>
#include <type_traits>
#include <iostream>
#include <functional>
#include <variant>

namespace details
{

  struct ObjectPrint
  {
  };

  template <typename T>
  ObjectPrint &operator<<(ObjectPrint &printer, T &data)
  {
    std::cout << "{ ";
    data.serialize(printer);
    std::cout << "} ";
    return printer;
  }

  template <typename T>
    requires std::is_arithmetic_v<T>
  ObjectPrint &operator<<(ObjectPrint &printer, T &data)
  {
    if constexpr (sizeof(data) < 2)
    {
      std::cout << static_cast<int>(data) << " ";
    }
    else
    {
      std::cout << data << " ";
    }
    return printer;
  }

  ObjectPrint &operator<<(ObjectPrint &printer, std::string &data)
  {
    std::cout << data << " ";
    return printer;
  }

  template <typename T>
  ObjectPrint &operator<<(ObjectPrint &printer, std::vector<T> &data)
  {
    std::cout << "[ ";
    for (auto &elem : data)
    {
      printer << elem;
    }
    std::cout << "] ";
    return printer;
  }

}

namespace Serialize
{

  /**
   * WriteToBuffer - writes data to a binary format in a wrapped std::vector<uint8>
   */

  struct WriteToBuffer
  {
    std::vector<std::uint8_t> *buffer;
  };

  template <typename T>
  WriteToBuffer &operator<<(WriteToBuffer &wb, T &data)
  {
    data.serialize(wb);
    return wb;
  }

  template <typename T>
    requires std::is_arithmetic_v<T>
  WriteToBuffer &operator<<(WriteToBuffer &wb, T &data)
  {
    auto source = reinterpret_cast<const std::uint8_t *>(&data);
    wb.buffer->insert(wb.buffer->end(), source, source + sizeof(data));
    return wb;
  }

  WriteToBuffer &operator<<(WriteToBuffer &wb, std::string &data)
  {
    wb.buffer->push_back(data.size());
    wb.buffer->insert(wb.buffer->end(), data.begin(), data.end());
    return wb;
  }

  template <typename T>
  WriteToBuffer &operator<<(WriteToBuffer &wb, std::vector<T> &data)
  {
    wb.buffer->push_back(data.size());
    for (auto &elem : data)
    {
      wb << elem;
    }
    return wb;
  }

  template <typename... T>
  WriteToBuffer &operator<<(WriteToBuffer &wb, std::variant<T...> &data)
  {
    std::uint8_t index = data.index();
    wb << index;
    std::visit([&](auto &arg)
               { wb << arg; }, data);
    return wb;
  }

  /**
   * ReadFromBuffer - reads from a binary format in a wrapped std::vector<uint8> back to types
   */

  struct ReadFromBuffer
  {
    std::vector<std::uint8_t> *buffer;
    std::size_t offset = 0;
  };

  template <typename T>
  ReadFromBuffer &operator<<(ReadFromBuffer &rb, T &data)
  {
    data.serialize(rb);
    return rb;
  }

  template <typename T>
    requires std::is_arithmetic_v<T>
  ReadFromBuffer &operator<<(ReadFromBuffer &rb, T &data)
  {
    std::memcpy(&data, rb.buffer->data() + rb.offset, sizeof(data));
    rb.offset += sizeof(data);
    return rb;
  }

  template <>
  ReadFromBuffer &operator<<(ReadFromBuffer &rb, std::string &data)
  {
    auto size = (*rb.buffer)[rb.offset];
    ++rb.offset;
    data.assign(reinterpret_cast<const char *>(rb.buffer->data()) + rb.offset, size);
    rb.offset += size;
    return rb;
  }

  template <typename T>
  ReadFromBuffer &operator<<(ReadFromBuffer &rb, std::vector<T> &data)
  {
    auto size = (*rb.buffer)[rb.offset];
    ++rb.offset;
    data.resize(size);
    for (int i = 0; i < size; ++i)
    {
      rb << data[i];
    }
    return rb;
  }

  template <std::size_t Index, typename... T>
  void AssignToVariantByIndex(ReadFromBuffer &rb, std::size_t index, std::variant<T...> &data)
  {
    if constexpr (Index < sizeof...(T))
    {
      if (index == Index)
      {
        data = std::variant_alternative_t<Index, std::variant<T...>>{};
        rb << std::get<Index>(data);
      }
      else
      {
        AssignToVariantByIndex<Index + 1>(rb, index, data);
      }
    }
  }

  template <typename... T>
  ReadFromBuffer &operator<<(ReadFromBuffer &rb, std::variant<T...> &data)
  {
    auto type = (*rb.buffer)[rb.offset];
    ++rb.offset;
    if (type >= std::variant_size_v<std::variant<T...>>)
    {
      throw std::invalid_argument("Invalid type for variant in binary buffer");
    }
    AssignToVariantByIndex<0>(rb, type, data);
    return rb;
  }

}